"""회원 나이 계산과 시니어 기준(#inactive).

나이는 저장하지 않는다 - 생년월일(birth_date)이 있으면 그걸로 만 나이를, 없으면 출생연도
(birth_year = 등록한 해 - 그때 나이)로 "올해 - 출생연도"를 계산한다. 그래야 해가 바뀌어도
틀어지지 않는다. 시니어(user_type=SENIOR)는 여전히 저장된 값이 기준이고(가격 계산이 그걸
본다), 이 모듈은 등록/수정 때 나이로 기본값을 정해주는 용도다.
"""
import datetime
from typing import Optional

SENIOR_AGE = 70

KST = datetime.timezone(datetime.timedelta(hours=9))


def today_kst() -> datetime.date:
    return datetime.datetime.now(KST).date()


def age_of(birth_date: Optional[datetime.date], birth_year: Optional[int]) -> Optional[int]:
    today = today_kst()
    if birth_date:
        return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    if birth_year:
        return today.year - birth_year
    return None


def birth_year_from_age(age: Optional[int]) -> Optional[int]:
    return today_kst().year - age if age is not None else None


def user_type_for_age(age: Optional[int]) -> str:
    return "SENIOR" if age is not None and age >= SENIOR_AGE else "GENERAL"
