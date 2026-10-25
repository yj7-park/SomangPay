"""교인 명단으로 회원 전체 교체(2026-10-25) - 교회 교적 프로그램에서 받은 "교인 리스트" 엑셀 기준.

    python -m app.tools.import_members <dir>            # 미리보기(DB 변경 없음)
    python -m app.tools.import_members <dir> --apply    # 실제 반영

<dir>에는 members.jsonl(줄마다 {no, name, phone, birth_date, position, group, photo})과 photo가
가리키는 사진 파일(photos/*)이 있어야 한다. 엑셀(사진은 시트에 박힌 이미지)에서 이 형태로 뽑는 건
로컬에서 하고, 명단에는 실제 교인 개인정보가 들어 있으므로 저장소에 커밋하지 않고 컨테이너
/tmp 등에 잠깐 복사해 쓰고 지운다. 운영에서 --apply 전에는 반드시 pg_dump로 백업.

이 도구는 **교체**다 - 관리자(role=ADMIN) 계정과 메뉴/키오스크/가맹점/문자 발송 기기 설정만 남기고,
회원과 회원에 딸린 것(카드·사진·충전/결제/입금 이력·푸시 구독·문자 대기열·인증번호)을 전부 지운 뒤
명단으로 다시 만든다.

규칙
- 전원 비활성(status=INACTIVE) + 앱 미가입(password_set=False, 비밀번호 없음), 잔액 0, QR 카드 새로 발급.
- 회원 유형은 생년월일 기준 만 70세 이상 SENIOR(services/member_age.py), 생년월일 없으면 GENERAL.
- 이름은 입금자명 매칭 키라 유일해야 한다 - 동명이인은 명단 순서상 먼저 나온 사람이 원래 이름,
  다음부터 B, C...를 붙인다(관리자 등록 규칙 "홍길동B"와 같음).
- 같은 휴대폰 번호를 여러 명이 쓰면(가족 공용) 가장 나이 많은 사람만 번호를 갖고 나머지는 번호 없이
  등록한다(사용자 결정). 번호 없는 회원의 username(내부 ID)은 "member-<명단 No>".
- 직분(교회직분)/소속(교구)은 참고 정보로 church_position/church_group에 넣는다.
"""
import datetime
import json
import os
import sys
import uuid
from collections import defaultdict

from sqlalchemy import text

from app import models
from app.database import SessionLocal
from app.phone_utils import normalize_phone
from app.services import member_age

CONTENT_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif"}

WIPE_SQL = [
    "DELETE FROM payment_transaction_items",
    "DELETE FROM payment_transactions",
    "DELETE FROM deposit_histories",
    "DELETE FROM bank_transactions",
    "DELETE FROM user_activation_codes",
    "DELETE FROM sms_outbox",
    "DELETE FROM push_subscriptions WHERE user_id IN (SELECT id FROM users WHERE role <> 'ADMIN')",
    "DELETE FROM user_photos WHERE user_id IN (SELECT id FROM users WHERE role <> 'ADMIN')",
    "DELETE FROM nfc_cards WHERE user_id IN (SELECT id FROM users WHERE role <> 'ADMIN')",
    "UPDATE merchants SET user_id = NULL WHERE user_id IN (SELECT id FROM users WHERE role <> 'ADMIN')",
    "DELETE FROM users WHERE role <> 'ADMIN'",
]


def load(dir_path):
    rows = []
    with open(os.path.join(dir_path, "members.jsonl"), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def prepare(rows, admin_names):
    people = []
    for r in rows:
        name = (r.get("name") or "").strip()
        if not name:
            continue
        birth = None
        if r.get("birth_date"):
            try:
                birth = datetime.date.fromisoformat(str(r["birth_date"])[:10])
            except ValueError:
                birth = None
        phone = normalize_phone(str(r.get("phone") or "")) or None
        if phone and not (len(phone) == 11 and phone.startswith("01")):
            phone = None
        people.append({
            "no": str(r.get("no") or ""), "name": name, "phone": phone, "birth": birth,
            "position": (r.get("position") or "").strip() or None,
            "group": (r.get("group") or "").strip() or None,
            "photo": r.get("photo") or None,
        })

    # 공용 번호 - 생년월일이 가장 이른 사람만(생년월일 없으면 맨 뒤, 같으면 명단 순서).
    by_phone = defaultdict(list)
    for p in people:
        if p["phone"]:
            by_phone[p["phone"]].append(p)
    shared = []
    for phone, group in by_phone.items():
        if len(group) > 1:
            group.sort(key=lambda p: (p["birth"] is None, p["birth"] or datetime.date.max))
            for p in group[1:]:
                p["phone"] = None
            shared.append(f"{group[0]['name']} 외 {len(group) - 1}명")

    # 동명이인 - 먼저 나온 사람이 원래 이름. 관리자 계정 이름과도 겹치지 않게.
    used = set(p["name"] for p in people) | set(admin_names)
    seen = defaultdict(int)
    renamed = []
    for p in people:
        seen[p["name"]] += 1
        if seen[p["name"]] == 1 and p["name"] not in admin_names:
            continue
        for letter in "BCDEFGHIJKLMNOPQRSTUVWXYZ":
            cand = f"{p['name']}{letter}"
            if cand not in used:
                used.add(cand)
                renamed.append(f"{p['name']} -> {cand}")
                p["name"] = cand
                break
    return people, shared, renamed


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    dir_path = argv[1]
    apply = "--apply" in argv[2:]
    rows = load(dir_path)

    db = SessionLocal()
    try:
        admin_names = [n for (n,) in db.query(models.User.name).filter(models.User.role == "ADMIN").all()]
        people, shared, renamed = prepare(rows, admin_names)
        today = member_age.today_kst()
        seniors = sum(1 for p in people if member_age.user_type_for(p["birth"], today) == "SENIOR")
        photos = sum(1 for p in people if p["photo"] and os.path.exists(os.path.join(dir_path, p["photo"])))
        before = db.execute(text("SELECT count(*) FROM users WHERE role <> 'ADMIN'")).scalar()
        print(f"명단 {len(rows)}줄 -> 회원 {len(people)}명 (기존 회원 {before}명은 이력과 함께 삭제)")
        print(f"  휴대폰 있음 {sum(1 for p in people if p['phone'])}, 사진 {photos}, 시니어(만 70세+) {seniors},"
              f" 생년월일 없음 {sum(1 for p in people if not p['birth'])}")
        print(f"  공용 번호 {len(shared)}개 - 가장 나이 많은 사람만 번호 유지")
        for line in renamed:
            print("  동명이인:", line)
        if not apply:
            print("미리보기만 했습니다 - 반영하려면 --apply")
            return 0

        for sql in WIPE_SQL:
            db.execute(text(sql))
        now = datetime.datetime.utcnow()
        for p in people:
            user = models.User(
                username=p["phone"] or f"member-{p['no'] or uuid.uuid4().hex[:8]}",
                name=p["name"],
                phone=p["phone"],
                role="USER",
                user_type=member_age.user_type_for(p["birth"], today) or "GENERAL",
                birth_date=p["birth"],
                church_position=p["position"],
                church_group=p["group"],
                credit_balance=0,
                password_hash=None,
                password_set=False,
                status="INACTIVE",
            )
            db.add(user)
            db.flush()
            db.add(models.NFCCard(
                card_uid=str(uuid.uuid4()),
                card_name=f"{user.name}의 교인증 QR 코드",
                card_type="QR_CODE",
                user_id=user.id,
            ))
            if p["photo"]:
                path = os.path.join(dir_path, p["photo"])
                if os.path.exists(path):
                    with open(path, "rb") as f:
                        data = f.read()
                    ext = os.path.splitext(path)[1].lower()
                    db.add(models.UserPhoto(user_id=user.id, content_type=CONTENT_TYPES.get(ext, "image/jpeg"),
                                            image=data, updated_at=now))
                    user.photo_updated_at = now
        db.commit()
        after = db.execute(text("SELECT count(*) FROM users WHERE role <> 'ADMIN'")).scalar()
        print(f"반영 완료 - 회원 {after}명")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
