"""회원 만 나이와 시니어 자동 판정.

생년월일(birth_date)이 있는 회원은 만 SENIOR_AGE세 이상이면 SENIOR(키오스크 할인가), 아니면 GENERAL로
맞춘다. 생년월일이 없는 회원만 관리자가 고른 회원 유형을 그대로 쓴다. 나이 자체는 저장하지 않는다.

만 나이는 생일이 지나야 오르므로 main.py 유지보수 루프(_run_deposit_reminders)가 주기적으로
recompute_all을 돌려 생일이 지난 회원을 SENIOR로 넘긴다. 관리자 회원 등록/수정과 명단 일괄
등록(tools/import_members.py)도 같은 apply/user_type_for를 쓴다.
"""
import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app import models

SENIOR_AGE = 70

KST = datetime.timezone(datetime.timedelta(hours=9))


def today_kst() -> datetime.date:
    return datetime.datetime.now(KST).date()


def age_of(birth_date: Optional[datetime.date], today: Optional[datetime.date] = None) -> Optional[int]:
    if not birth_date:
        return None
    today = today or today_kst()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


def user_type_for(birth_date: Optional[datetime.date], today: Optional[datetime.date] = None) -> Optional[str]:
    """생년월일 기준 회원 유형. 생년월일이 없으면 None(판정 안 함)."""
    age = age_of(birth_date, today)
    if age is None:
        return None
    return "SENIOR" if age >= SENIOR_AGE else "GENERAL"


def apply(user: models.User) -> None:
    t = user_type_for(user.birth_date)
    if t and user.role != "ADMIN":
        user.user_type = t


def recompute_all(db: Session) -> int:
    today = today_kst()
    changed = 0
    users = db.query(models.User).filter(models.User.birth_date.isnot(None), models.User.role != "ADMIN").all()
    for user in users:
        t = user_type_for(user.birth_date, today)
        if t and user.user_type != t:
            user.user_type = t
            changed += 1
    if changed:
        db.commit()
    return changed
