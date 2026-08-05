"""
SomangPay Enterprise Automated Test Suite (Continuous System Inspection)
Covers all Use Cases: UC-01 to UC-08
"""
import sys
import time
import requests

BASE_URL = "http://localhost:8000/api"

class TestColors:
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def wait_for_server():
    for _ in range(10):
        try:
            r = requests.get(f"{BASE_URL}/products")
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(1)
    return False

def log_test(uc_code, name, status, details=""):
    color = TestColors.OKGREEN if status == "PASS" else TestColors.FAIL
    print(f"{TestColors.BOLD}[{uc_code}] {name:<45}{TestColors.ENDC} -> {color}{status}{TestColors.ENDC} {details}")

def get_or_create_default_product():
    try:
        r = requests.get(f"{BASE_URL}/products")
        if r.status_code == 200 and len(r.json()) > 0:
            return r.json()[0]["id"]
        
        # 신규 상품 생성
        r_create = requests.post(f"{BASE_URL}/products", json={
            "name": "식권 (기본)",
            "price_general": 4000,
            "price_senior": 1000,
            "merchant_id": 1
        })
        if r_create.status_code == 200:
            return r_create.json()["id"]
    except Exception:
        pass
    return 1

def run_all_usecase_tests():
    print(f"\n{TestColors.BOLD}========================================================")
    print("🚀 SOMANGPAY USE CASE AUTOMATED TEST SUITE RUNNING")
    print(f"========================================================{TestColors.ENDC}\n")

    if not wait_for_server():
        print(f"{TestColors.FAIL}서버에 연결할 수 없습니다.{TestColors.ENDC}")
        return False

    # Ensure default product exists
    r_prod = requests.post(f"{BASE_URL}/products", json={
        "name": "식권 (기본)",
        "price_general": 4000,
        "price_senior": 1000,
        "merchant_id": 1
    })
    default_prod_id = r_prod.json()["id"] if r_prod.status_code == 200 else get_or_create_default_product()

    passed_count = 0
    total_count = 8

    # ----------------------------------------------------
    # UC-06: Phone Number Account User Registration
    # ----------------------------------------------------
    test_phone_id = f"010-8888-{int(time.time()) % 10000:04d}"
    test_user_id = None
    account_num = f"302-8888-{int(time.time()) % 10000:04d}-01"
    try:
        r6 = requests.post(f"{BASE_URL}/users/register", json={
            "username": test_phone_id,
            "name": "박복자 회원",
            "phone": test_phone_id,
            "user_type": "SENIOR",
            "bank_name": "NH농협",
            "account_number": account_num
        })
        if r6.status_code == 200:
            user_data = r6.json()
            test_user_id = user_data["id"]
            log_test("UC-06", "휴대폰 번호 기반 신규 회원 가입", "PASS", f"(ID: {user_data['username']})")
            passed_count += 1
        else:
            log_test("UC-06", "휴대폰 번호 기반 신규 회원 가입", "FAIL", f"Status: {r6.status_code}")
    except Exception as e:
        log_test("UC-06", "휴대폰 번호 기반 신규 회원 가입", "FAIL", str(e))

    # ----------------------------------------------------
    # UC-02: User Login & Info Management
    # ----------------------------------------------------
    try:
        r2_login = requests.post(f"{BASE_URL}/users/login", json={
            "username": test_phone_id,
            "password": "1234"
        })
        r2_edit = requests.put(f"{BASE_URL}/users/{test_user_id}/info", json={
            "phone": test_phone_id,
            "bank_name": "NH농협",
            "account_number": account_num
        })
        if r2_login.status_code == 200 and r2_edit.status_code == 200:
            log_test("UC-02", "회원 보안 로그인 및 개인 정보 수정", "PASS", f"(Login & Update OK)")
            passed_count += 1
        else:
            log_test("UC-02", "회원 보안 로그인 및 개인 정보 수정", "FAIL")
    except Exception as e:
        log_test("UC-02", "회원 보안 로그인 및 개인 정보 수정", "FAIL", str(e))

    # ----------------------------------------------------
    # UC-07: Multi-Modal Admin Authentication (PIN/NFC/QR)
    # ----------------------------------------------------
    try:
        r7_pin = requests.post(f"{BASE_URL}/admin/verify-auth", json={"pin": "1234"})
        if r7_pin.status_code == 200 and r7_pin.json().get("success"):
            log_test("UC-07", "관리자 다중 매체 보안 인증 (PIN/NFC/QR)", "PASS", f"(Auth Type: PIN)")
            passed_count += 1
        else:
            log_test("UC-07", "관리자 다중 매체 보안 인증 (PIN/NFC/QR)", "FAIL")
    except Exception as e:
        log_test("UC-07", "관리자 다중 매체 보안 인증 (PIN/NFC/QR)", "FAIL", str(e))

    # ----------------------------------------------------
    # UC-05: Kiosk Provisioning & Default Quick Pay Setup
    # ----------------------------------------------------
    test_device_uuid = f"DEV_TEST_{int(time.time())}"
    try:
        default_prod_id = get_or_create_default_product()
        
        r5 = requests.post(f"{BASE_URL}/kiosk/device/sync", json={
            "device_uuid": test_device_uuid,
            "device_name": "식당 라면 코너 키오스크 1호기",
            "merchant_id": 1,
            "default_product_id": default_prod_id,
            "default_quantity": 1
        })
        if r5.status_code == 200 and r5.json().get("default_product_id") == default_prod_id:
            log_test("UC-05", "키오스크 프로비저닝 및 기본 결제 설정", "PASS", f"(Default Pay Item ID: {default_prod_id})")
            passed_count += 1
        else:
            log_test("UC-05", "키오스크 프로비저닝 및 기본 결제 설정", "FAIL", f"DefaultProdID: {default_prod_id}, Resp: {r5.text}")
    except Exception as e:
        log_test("UC-05", "키오스크 프로비저닝 및 기본 결제 설정", "FAIL", str(e))

    # ----------------------------------------------------
    # UC-03: Proxy Credential Registration (NFC & QR)
    # ----------------------------------------------------
    test_qr_code = f"CHURCH_QR_{int(time.time())}"
    try:
        r3 = requests.post(f"{BASE_URL}/cards/register", json={
            "card_uid": test_qr_code,
            "card_name": "박복자 교인증 QR 코드",
            "card_type": "QR_CODE",
            "user_id": test_user_id
        })
        if r3.status_code == 200 and r3.json().get("card_type") == "QR_CODE":
            log_test("UC-03", "관리자 식별자(NFC/QR) 대리 발급", "PASS", f"(Code: {test_qr_code})")
            passed_count += 1
        else:
            log_test("UC-03", "관리자 식별자(NFC/QR) 대리 발급", "FAIL")
    except Exception as e:
        log_test("UC-03", "관리자 식별자(NFC/QR) 대리 발급", "FAIL", str(e))

    # Initial Credit Recharge for Testing
    requests.post(f"{BASE_URL}/admin/recharge-credit", json={"user_id": test_user_id, "amount": 50000})

    # ----------------------------------------------------
    # UC-01: Dual Payment & Default Quick Payment Approval
    # ----------------------------------------------------
    try:
        r1 = requests.post(f"{BASE_URL}/payments/pay", json={
            "card_uid": test_qr_code,
            "device_uuid": test_device_uuid,
            "items": [] # Empty items triggers Default Quick Pay (식권 x1)
        })
        if r1.status_code == 200 and r1.json().get("status") == "SUCCESS":
            log_test("UC-01", "무인 키오스크 듀얼 승인 및 기본 자동 결제", "PASS", f"(Balance: {r1.json()['balance_after']:,}원)")
            passed_count += 1
        else:
            log_test("UC-01", "무인 키오스크 듀얼 승인 및 기본 자동 결제", "FAIL", r1.text)
    except Exception as e:
        log_test("UC-01", "무인 키오스크 듀얼 승인 및 기본 자동 결제", "FAIL", str(e))

    # ----------------------------------------------------
    # UC-08: 30-Second Duplicate Payment Prevention & Confirmation
    # ----------------------------------------------------
    try:
        # Immediate re-payment attempt (within 30 seconds)
        r8_dup = requests.post(f"{BASE_URL}/payments/pay", json={
            "card_uid": test_qr_code,
            "device_uuid": test_device_uuid,
            "items": []
        })
        is_confirm_required = r8_dup.status_code == 200 and r8_dup.json().get("status") == "CONFIRM_REQUIRED"

        # Force confirm 2nd payment
        r8_force = requests.post(f"{BASE_URL}/payments/pay", json={
            "card_uid": test_qr_code,
            "device_uuid": test_device_uuid,
            "items": [],
            "force_confirm": True
        })
        is_force_success = r8_force.status_code == 200 and r8_force.json().get("status") == "SUCCESS"

        if is_confirm_required and is_force_success:
            log_test("UC-08", "기본 결제 키오스크 30초 이내 중복 결제 방지", "PASS", "(Detect CONFIRM_REQUIRED & Force Approval OK)")
            passed_count += 1
        else:
            log_test("UC-08", "기본 결제 키오스크 30초 이내 중복 결제 방지", "FAIL", f"Confirm: {is_confirm_required}, Force: {is_force_success}")
    except Exception as e:
        log_test("UC-08", "기본 결제 키오스크 30초 이내 중복 결제 방지", "FAIL", str(e))

    # ----------------------------------------------------
    # UC-04: NH Bank Account Auto Reconciliation
    # ----------------------------------------------------
    try:
        r4 = requests.post(f"{BASE_URL}/nhbank/mock-deposit", json={
            "source_account": account_num,
            "amount": 20000
        })
        if r4.status_code == 200 and r4.json().get("success"):
            log_test("UC-04", "NH농협 계좌 입금 자동 매칭 충전", "PASS", f"(Recharged +20,000원)")
            passed_count += 1
        else:
            log_test("UC-04", "NH농협 계좌 입금 자동 매칭 충전", "FAIL", r4.text)
    except Exception as e:
        log_test("UC-04", "NH농협 계좌 입금 자동 매칭 충전", "FAIL", str(e))

    print(f"\n{TestColors.BOLD}========================================================")
    if passed_count == total_count:
        print(f"🎉 {TestColors.OKGREEN}ALL USE CASE TESTS PASSED! ({passed_count}/{total_count}){TestColors.ENDC}")
    else:
        print(f"⚠️ {TestColors.FAIL}TEST SUITE FINISHED: {passed_count}/{total_count} PASSED.{TestColors.ENDC}")
    print(f"========================================================{TestColors.ENDC}\n")

    return passed_count == total_count

if __name__ == "__main__":
    success = run_all_usecase_tests()
    sys.exit(0 if success else 1)
