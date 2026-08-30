"""
SomangPay Enterprise Automated Test Suite (Continuous System Inspection)
Covers all Use Cases: UC-01 to UC-11
"""
import os
import sys
import time
import requests

BASE_URL = "http://localhost:8000/api"
ADMIN_PIN = os.getenv("ADMIN_PIN", "1234")

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
    except Exception:
        pass
    return None

def run_all_usecase_tests():
    print(f"\n{TestColors.BOLD}========================================================")
    print("🚀 SOMANGPAY USE CASE AUTOMATED TEST SUITE RUNNING")
    print(f"========================================================{TestColors.ENDC}\n")

    if not wait_for_server():
        print(f"{TestColors.FAIL}서버에 연결할 수 없습니다.{TestColors.ENDC}")
        return False

    passed_count = 0
    total_count = 11
    unique_suffix = int(time.time()) % 100000

    # ----------------------------------------------------
    # UC-07: Multi-Modal Admin Authentication (PIN/NFC/QR) - 이후 모든 관리자 API가 이 토큰을 필요로 함
    # ----------------------------------------------------
    admin_token = None
    try:
        r7_pin = requests.post(f"{BASE_URL}/admin/verify-auth", json={"pin": ADMIN_PIN})
        if r7_pin.status_code == 200 and r7_pin.json().get("success"):
            admin_token = r7_pin.json()["token"]
            log_test("UC-07", "관리자 다중 매체 보안 인증 (PIN/NFC/QR)", "PASS", "(Auth Type: PIN)")
            passed_count += 1
        else:
            log_test("UC-07", "관리자 다중 매체 보안 인증 (PIN/NFC/QR)", "FAIL", r7_pin.text)
    except Exception as e:
        log_test("UC-07", "관리자 다중 매체 보안 인증 (PIN/NFC/QR)", "FAIL", str(e))

    if not admin_token:
        print(f"{TestColors.FAIL}관리자 토큰 발급 실패로 나머지 테스트를 진행할 수 없습니다.{TestColors.ENDC}")
        return False

    admin_headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

    # Ensure default product exists
    r_prod = requests.post(f"{BASE_URL}/products", headers=admin_headers, json={
        "name": "식권 (기본)",
        "price_general": 4000,
        "price_senior": 1000,
        "merchant_id": 1
    })
    default_prod_id = r_prod.json()["id"] if r_prod.status_code == 200 else get_or_create_default_product()

    # ----------------------------------------------------
    # UC-06: 관리자 대리 회원 등록 (전화번호 = 로그인 ID)
    # ----------------------------------------------------
    test_phone = f"010-8888-{unique_suffix:05d}"[:13]
    test_name = f"박복자 회원 {unique_suffix}"
    test_user_id = None
    try:
        r6 = requests.post(f"{BASE_URL}/admin/register-user", headers=admin_headers, json={
            "name": test_name,
            "phone": test_phone,
            "user_type": "SENIOR",
        })
        if r6.status_code == 200:
            user_data = r6.json()
            test_user_id = user_data["id"]
            log_test("UC-06", "관리자 대리 회원 등록 (전화번호 ID)", "PASS", f"(ID: {user_data['username']})")
            passed_count += 1
        else:
            log_test("UC-06", "관리자 대리 회원 등록 (전화번호 ID)", "FAIL", f"Status: {r6.status_code}, {r6.text}")
    except Exception as e:
        log_test("UC-06", "관리자 대리 회원 등록 (전화번호 ID)", "FAIL", str(e))

    # ----------------------------------------------------
    # UC-09: 동명이인 등록 거부
    # ----------------------------------------------------
    try:
        r9 = requests.post(f"{BASE_URL}/admin/register-user", headers=admin_headers, json={
            "name": test_name,  # 이미 위에서 등록한 이름과 동일
            "phone": f"010-7777-{unique_suffix:05d}"[:13],
            "user_type": "GENERAL",
        })
        if r9.status_code == 400:
            log_test("UC-09", "동명이인 중복 이름 등록 거부", "PASS", "(400 Bad Request 확인)")
            passed_count += 1
        else:
            log_test("UC-09", "동명이인 중복 이름 등록 거부", "FAIL", f"Status: {r9.status_code}")
    except Exception as e:
        log_test("UC-09", "동명이인 중복 이름 등록 거부", "FAIL", str(e))

    # ----------------------------------------------------
    # UC-02: 전화번호+비밀번호 로그인 및 본인 정보 조회
    # ----------------------------------------------------
    user_token = None
    try:
        r2_login = requests.post(f"{BASE_URL}/users/login", json={"phone": test_phone, "password": "1234"})
        if r2_login.status_code == 200 and r2_login.json().get("token"):
            user_token = r2_login.json()["token"]
            r2_me = requests.get(f"{BASE_URL}/users/me", headers={"Authorization": f"Bearer {user_token}"})
            if r2_me.status_code == 200 and r2_me.json().get("name") == test_name:
                log_test("UC-02", "전화번호 로그인 및 본인 정보(/me) 조회", "PASS")
                passed_count += 1
            else:
                log_test("UC-02", "전화번호 로그인 및 본인 정보(/me) 조회", "FAIL", r2_me.text)
        else:
            log_test("UC-02", "전화번호 로그인 및 본인 정보(/me) 조회", "FAIL", r2_login.text)
    except Exception as e:
        log_test("UC-02", "전화번호 로그인 및 본인 정보(/me) 조회", "FAIL", str(e))

    # ----------------------------------------------------
    # UC-05: Kiosk Provisioning & Default Quick Pay Setup
    # ----------------------------------------------------
    test_device_uuid = f"DEV_TEST_{int(time.time())}"
    try:
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
            log_test("UC-05", "키오스크 프로비저닝 및 기본 결제 설정", "FAIL", f"Resp: {r5.text}")
    except Exception as e:
        log_test("UC-05", "키오스크 프로비저닝 및 기본 결제 설정", "FAIL", str(e))

    # ----------------------------------------------------
    # UC-03: NFC 카드 등록·교체 (회원당 최대 1개) / QR은 가입 시 자동 발급 + 재발급만 허용
    # ----------------------------------------------------
    test_nfc_uid = f"CARD_NFC_{unique_suffix}"
    try:
        # 가입 시 QR_CODE 카드가 UUID로 자동 발급되어 있어야 한다 (admin_register_user).
        r3_list0 = requests.get(f"{BASE_URL}/cards/user/{test_user_id}", headers=admin_headers)
        cards_at_signup = r3_list0.json() if r3_list0.status_code == 200 else []
        auto_qr = next((c for c in cards_at_signup if c["card_type"] == "QR_CODE"), None)
        auto_qr_issued_ok = auto_qr is not None and len(auto_qr["card_uid"]) == 36

        # QR은 더 이상 이 API로 등록할 수 없다 (400 Bad Request여야 함).
        r3_qr_rejected = requests.put(f"{BASE_URL}/admin/cards", headers=admin_headers, json={
            "user_id": test_user_id, "card_type": "QR_CODE", "card_uid": f"CHURCH_QR_{unique_suffix}"
        })
        qr_put_rejected_ok = r3_qr_rejected.status_code == 400

        r3b = requests.put(f"{BASE_URL}/admin/cards", headers=admin_headers, json={
            "user_id": test_user_id, "card_type": "NFC", "card_uid": test_nfc_uid
        })
        # 같은 회원의 같은 타입(NFC)에 새 UID로 재등록 -> 교체되어야 함
        replaced_nfc_uid = f"CARD_NFC_REPLACED_{unique_suffix}"
        r3c = requests.put(f"{BASE_URL}/admin/cards", headers=admin_headers, json={
            "user_id": test_user_id, "card_type": "NFC", "card_uid": replaced_nfc_uid
        })
        r3_list = requests.get(f"{BASE_URL}/cards/user/{test_user_id}", headers=admin_headers)
        cards_after_replace = r3_list.json() if r3_list.status_code == 200 else []
        nfc_cards = [c for c in cards_after_replace if c["card_type"] == "NFC"]
        replaced_ok = len(nfc_cards) == 1 and nfc_cards[0]["card_uid"] == replaced_nfc_uid

        # QR 재발급 확인 - 새 UUID로 바뀌고, 기존 값과는 달라야 한다.
        r3_reissue = requests.post(f"{BASE_URL}/admin/cards/qr-reissue/{test_user_id}", headers=admin_headers)
        reissued_uid = r3_reissue.json().get("card_uid") if r3_reissue.status_code == 200 else None
        reissue_ok = (
            r3_reissue.status_code == 200
            and r3_reissue.json().get("card_type") == "QR_CODE"
            and bool(auto_qr) and reissued_uid != auto_qr["card_uid"]
        )

        if r3b.status_code == 200 and r3c.status_code == 200 and auto_qr_issued_ok and qr_put_rejected_ok and replaced_ok and reissue_ok:
            log_test("UC-03", "NFC 카드 등록·교체 / QR 자동발급·재발급", "PASS", f"(NFC UID: {replaced_nfc_uid})")
            passed_count += 1
        else:
            log_test("UC-03", "NFC 카드 등록·교체 / QR 자동발급·재발급", "FAIL",
                      f"auto_qr_ok={auto_qr_issued_ok}, qr_put_rejected_ok={qr_put_rejected_ok}, replace_ok={replaced_ok}, reissue_ok={reissue_ok}")
    except Exception as e:
        log_test("UC-03", "NFC 카드 등록·교체 / QR 자동발급·재발급", "FAIL", str(e))
        replaced_nfc_uid = test_nfc_uid  # 실패 시에도 이후 결제 테스트가 쓸 수 있도록 폴백

    # ----------------------------------------------------
    # UC-04: 계좌 입금 자동 매칭(입금자명=회원명) -> 회원이 선택해 충전 완료 / 미매칭은 오류 처리
    # ----------------------------------------------------
    try:
        # A) 입금자명이 등록 회원과 자동 매칭 -> 회원 앱에 대기로 노출 -> 회원이 선택해 충전 완료
        amount_a = 12000
        r4a_create = requests.post(f"{BASE_URL}/admin/bank-transactions", headers=admin_headers, json={
            "external_txn_id": f"TXN_A_{unique_suffix}", "amount": amount_a, "depositor_name": test_name
        })
        txn_a = r4a_create.json() if r4a_create.status_code == 200 else {}
        a_pending_ok = r4a_create.status_code == 200 and txn_a.get("status") == "PENDING" and txn_a.get("matched_user_id") == test_user_id

        r4a_me = requests.get(f"{BASE_URL}/bank-transactions/me", headers={"Authorization": f"Bearer {user_token}"})
        a_visible_ok = r4a_me.status_code == 200 and any(t["id"] == txn_a.get("id") and t["status"] == "PENDING" for t in r4a_me.json())

        r4a_claim = requests.post(f"{BASE_URL}/bank-transactions/{txn_a.get('id')}/claim", headers={"Authorization": f"Bearer {user_token}"})
        a_claim_ok = r4a_claim.status_code == 200 and r4a_claim.json().get("success") is True

        # B) 입금자명이 등록 회원과 안 맞으면 오류(ERROR) 상태로 남고 회원 목록에는 노출되지 않는다
        amount_b = 7000
        unknown_name = f"미등록{unique_suffix}"
        r4b_create = requests.post(f"{BASE_URL}/admin/bank-transactions", headers=admin_headers, json={
            "external_txn_id": f"TXN_B_{unique_suffix}", "amount": amount_b, "depositor_name": unknown_name
        })
        txn_b = r4b_create.json() if r4b_create.status_code == 200 else {}
        b_error_ok = r4b_create.status_code == 200 and txn_b.get("status") == "ERROR" and txn_b.get("matched_user_id") is None

        r4b_me = requests.get(f"{BASE_URL}/bank-transactions/me", headers={"Authorization": f"Bearer {user_token}"})
        b_hidden_ok = r4b_me.status_code == 200 and all(t["id"] != txn_b.get("id") for t in r4b_me.json())

        if a_pending_ok and a_visible_ok and a_claim_ok and b_error_ok and b_hidden_ok:
            log_test("UC-04", "계좌 입금 자동 매칭 -> 회원 선택 충전 / 미매칭은 오류 처리", "PASS", f"(+{amount_a:,}원)")
            passed_count += 1
        else:
            log_test("UC-04", "계좌 입금 자동 매칭 -> 회원 선택 충전 / 미매칭은 오류 처리", "FAIL",
                      f"a_pending_ok={a_pending_ok}, a_visible_ok={a_visible_ok}, a_claim_ok={a_claim_ok}, b_error_ok={b_error_ok}, b_hidden_ok={b_hidden_ok}")
    except Exception as e:
        log_test("UC-04", "계좌 입금 자동 매칭 -> 회원 선택 충전 / 미매칭은 오류 처리", "FAIL", str(e))

    # ----------------------------------------------------
    # UC-11: 관리자가 매칭 오류(ERROR) 건에 회원을 지정해 대신 충전 처리(완료-예외)
    # ----------------------------------------------------
    try:
        approve_ok = False
        if txn_b.get("id"):
            r11_resolve = requests.post(f"{BASE_URL}/admin/bank-transactions/{txn_b['id']}/resolve", headers=admin_headers,
                                         json={"user_id": test_user_id, "memo": "테스트: 오류건 관리자 수동 처리"})
            approve_ok = r11_resolve.status_code == 200 and r11_resolve.json().get("status") == "CREDITED_MANUAL"

        if approve_ok:
            log_test("UC-11", "관리자가 매칭 오류 건에 회원 지정해 대신 충전 처리", "PASS", f"(+{amount_b:,}원)")
            passed_count += 1
        else:
            log_test("UC-11", "관리자가 매칭 오류 건에 회원 지정해 대신 충전 처리", "FAIL", f"txn_b={txn_b}")
    except Exception as e:
        log_test("UC-11", "관리자가 매칭 오류 건에 회원 지정해 대신 충전 처리", "FAIL", str(e))

    # ----------------------------------------------------
    # UC-10: 관리자 통계 요약 API
    # ----------------------------------------------------
    try:
        r10 = requests.get(f"{BASE_URL}/admin/stats/summary", headers=admin_headers)
        data = r10.json() if r10.status_code == 200 else {}
        expected_keys = {"total_users", "total_balance", "users_with_balance", "pending_deposit_count", "error_deposit_count", "today", "this_week", "this_month"}
        if r10.status_code == 200 and expected_keys.issubset(data.keys()) and data["total_users"] >= 1:
            log_test("UC-10", "관리자 통계 요약 API", "PASS", f"(총 회원수: {data['total_users']})")
            passed_count += 1
        else:
            log_test("UC-10", "관리자 통계 요약 API", "FAIL", r10.text)
    except Exception as e:
        log_test("UC-10", "관리자 통계 요약 API", "FAIL", str(e))

    # ----------------------------------------------------
    # UC-01: Dual Payment & Default Quick Payment Approval
    # ----------------------------------------------------
    try:
        r1 = requests.post(f"{BASE_URL}/payments/pay", json={
            "card_uid": replaced_nfc_uid,
            "device_uuid": test_device_uuid,
            "items": []  # Empty items triggers Default Quick Pay (식권 x1)
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
            "card_uid": replaced_nfc_uid,
            "device_uuid": test_device_uuid,
            "items": []
        })
        is_confirm_required = r8_dup.status_code == 200 and r8_dup.json().get("status") == "CONFIRM_REQUIRED"

        # Force confirm 2nd payment
        r8_force = requests.post(f"{BASE_URL}/payments/pay", json={
            "card_uid": replaced_nfc_uid,
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
