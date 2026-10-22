"""교적 명단 일괄 등록(#inactive) - 지저스온 교회요람에서 가져온 명단을 비활성(INACTIVE) 회원으로 넣는다.

    python -m app.tools.import_members <dir>            # 미리보기(DB 변경 없음)
    python -m app.tools.import_members <dir> --apply    # 실제 반영

<dir>에는 members.jsonl(줄마다 {name, role, group, age, phone, photo})과 photo가 가리키는
사진 파일(photos/*.png)이 있어야 한다. 명단에는 실제 교인 개인정보가 들어 있으므로 저장소에
커밋하지 않고 컨테이너 /tmp 등에 잠깐 복사해 쓰고 지운다.

규칙
- 새 회원은 status=INACTIVE, password_set=False(가입 전), 초기 비밀번호 1234 해시, QR 카드 발급
  (admin_register_user와 같은 모양). 70세 이상은 SENIOR.
- 같은 전화번호의 회원이 이미 있으면 새로 만들지 않고 비어 있는 참고 정보(나이/직분/소속/사진)만
  채운다 - 상태/구분/이름은 건드리지 않는다(이미 쓰고 있는 회원을 비활성으로 돌리지 않게).
- 같은 이름의 다른 회원이 있으면(이름은 입금자명 매칭 키라 유일해야 함) 건너뛰고 목록으로 알린다.
- 명단 안에서 전화번호가 겹치면(가족이 한 번호를 쓰는 경우) 먼저 나온 사람만 번호를 갖고
  뒤 사람은 번호 없이 등록한다. 번호 없는 회원의 username은 "noph-<이름>".
- 다시 돌려도 안전하다(이미 들어간 사람은 "기존 회원"으로 처리됨).
"""
import datetime
import json
import os
import sys
import uuid

from app import models, security
from app.database import SessionLocal
from app.phone_utils import normalize_phone
from app.services.member_age import birth_year_from_age, user_type_for_age


def load(dir_path):
    rows = []
    with open(os.path.join(dir_path, "members.jsonl"), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def read_photo(dir_path, rel):
    if not rel:
        return None
    p = os.path.join(dir_path, rel)
    if not os.path.exists(p):
        return None
    with open(p, "rb") as f:
        return f.read()


def set_photo(db, user, data, now):
    photo = db.get(models.UserPhoto, user.id)
    if photo is None:
        db.add(models.UserPhoto(user_id=user.id, content_type="image/png", image=data, updated_at=now))
    else:
        photo.image = data
        photo.updated_at = now
    user.photo_updated_at = now


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    dir_path = argv[1]
    apply = "--apply" in argv[2:]
    rows = load(dir_path)

    db = SessionLocal()
    now = datetime.datetime.utcnow()
    default_pw = security.hash_password("1234")
    created, updated, skipped, phone_dropped = [], [], [], []
    seen_phones = set()
    try:
        for r in rows:
            name = (r.get("name") or "").strip()
            if not name:
                continue
            phone = normalize_phone(r.get("phone") or "") or None
            age = r.get("age")
            photo = read_photo(dir_path, r.get("photo"))

            by_phone = db.query(models.User).filter(models.User.phone == phone).first() if phone else None
            by_name = db.query(models.User).filter(models.User.name == name).first()
            existing = None
            if by_phone is not None and by_phone.name == name:
                existing = by_phone
            elif by_name is not None and by_name.phone is None:
                existing = by_name  # 예전 실행에서 번호 없이 들어간 사람
            elif by_name is not None:
                skipped.append(f"{name}: 같은 이름의 다른 회원이 이미 있음(동명이인이면 구분 이름으로 따로 등록)")
                continue
            if existing is not None:
                if existing.birth_year is None and existing.birth_date is None and age is not None:
                    existing.birth_year = birth_year_from_age(age)
                existing.church_position = existing.church_position or r.get("role") or None
                existing.church_group = existing.church_group or r.get("group") or None
                if photo and existing.photo_updated_at is None:
                    set_photo(db, existing, photo, now)
                updated.append(name)
                if phone:
                    seen_phones.add(phone)
                continue

            if phone and (phone in seen_phones or by_phone is not None):
                other = by_phone.name if by_phone is not None else "명단의 다른 사람"
                phone_dropped.append(f"{name}: 번호 {phone}를 {other}과(와) 같이 써서 번호 없이 등록")
                phone = None
            if phone:
                seen_phones.add(phone)

            user = models.User(
                username=phone or f"noph-{name}",
                name=name,
                phone=phone,
                role="USER",
                user_type=user_type_for_age(age),
                birth_year=birth_year_from_age(age),
                church_position=r.get("role") or None,
                church_group=r.get("group") or None,
                credit_balance=0,
                password_hash=default_pw,
                password_set=False,
                status="INACTIVE",
            )
            db.add(user)
            db.flush()
            db.add(models.NFCCard(
                card_uid=str(uuid.uuid4()),
                card_name=f"{name}의 교인증 QR 코드",
                card_type="QR_CODE",
                user_id=user.id,
            ))
            if photo:
                set_photo(db, user, photo, now)
            created.append(name)

        seniors = sum(1 for r in rows if (r.get("age") or 0) >= 70)
        print(f"명단 {len(rows)}명 -> 새로 등록 {len(created)}, 기존 회원 정보 보강 {len(updated)}, 건너뜀 {len(skipped)}")
        print(f"(명단 기준 70세 이상 {seniors}명)")
        for line in skipped:
            print("  건너뜀:", line)
        for line in phone_dropped:
            print("  번호 없음:", line)
        if updated:
            more = f" 외 {len(updated) - 10}명" if len(updated) > 10 else ""
            print("  기존 회원:", ", ".join(updated[:10]) + more)
        if apply:
            db.commit()
            print("반영 완료")
        else:
            db.rollback()
            print("미리보기만 했습니다 - 반영하려면 --apply")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
