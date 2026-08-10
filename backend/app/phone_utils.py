import re


def normalize_phone(raw: str) -> str:
    """전화번호를 숫자만 남겨 정규화한다. 저장/조회 키로 쓰며, 하이픈 유무와 무관하게 동일 취급한다."""
    if not raw:
        return raw
    return re.sub(r"\D", "", raw)


def format_phone(digits: str) -> str:
    """정규화된 숫자 전화번호를 표시용으로 하이픈을 넣어 포맷한다 (010-1234-5678 등)."""
    if not digits:
        return digits
    d = re.sub(r"\D", "", digits)
    if len(d) == 11:  # 010-XXXX-XXXX
        return f"{d[0:3]}-{d[3:7]}-{d[7:11]}"
    if len(d) == 10:
        if d.startswith("02"):  # 02-XXXX-XXXX (서울 지역번호)
            return f"{d[0:2]}-{d[2:6]}-{d[6:10]}"
        return f"{d[0:3]}-{d[3:6]}-{d[6:10]}"  # 011-XXX-XXXX 등
    return d
