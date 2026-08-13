# 입금 매칭 자동화 — SMS 알림 파싱 방식 전환 (핸드오프 문서)

작성일: 2026-08-09
작성 배경: 은행 API 연동 방식을 검토하다가, 연동 난이도 문제로 "문자 알림 파싱" 방식으로 전환하기로 결정. 이후 작업을 이어받는 agent를 위한 컨텍스트 정리.

---

## 1. 목표

교회 수신계좌로 들어오는 입금을 자동으로 감지해서, 미리 등록된 사용자(충전 신청자)와 매칭시켜 크레딧을 충전하는 기능. 현재는 관리자가 입금 내역을 수동으로 입력하는 "입금 시뮬레이터"로 대체돼 있는 상태이며, 이를 자동화하는 게 목표.

## 2. 현재 코드베이스 관련 구조

- [backend/app/services/bank_client.py](../backend/app/services/bank_client.py) — 은행 조회 연동 계층. 현재는 모킹 상태로 `fetch_new_transactions()`가 항상 빈 리스트 반환. 실제 데이터는 관리자가 `POST /api/admin/bank-transactions`로 대신 입력 중 (관리자 대시보드 "입금 시뮬레이터"). `RawBankTransaction` 타입: `external_txn_id`, `amount`, `depositor_name`, `transaction_at`(ISO 8601).
- [backend/app/services/recharge_matcher.py](../backend/app/services/recharge_matcher.py) — 매칭 로직 이미 구현됨. `depositor_name == user.name` AND `amount == requested_amount` 조건으로 `BankTransaction` ↔ `RechargeRequest` 양방향 매칭 (`try_resolve_recharge_request`, `try_resolve_bank_transaction`). 어느 데이터 소스로 `BankTransaction`이 채워지든 이 로직을 그대로 재사용 가능.
- [backend/app/models.py](../backend/app/models.py) — `BankTransaction`, `RechargeRequest`, `User`, `DepositHistory` 모델 존재 (필드는 위 매칭 로직 참고).
- [backend/app/phone_utils.py](../backend/app/phone_utils.py) — 전화번호 정규화 유틸. SMS 발신 관련은 아니고, 사용자 식별에 참고 가능.
- [android_kiosk/app/src/main/java/com/somangpay/kiosk/](../android_kiosk/app/src/main/java/com/somangpay/kiosk/) — 기존 무인 결제기(키오스크) Android 앱. `MainActivity.java`, NFC/USB 카드리더(`reader/` 패키지: `CardReaderManager`, `CcidUidReader`, `UsbDeviceClassifier`, `UsbHotplugReceiver`, `UsbPermissionReceiver`, `VendorHidUidReader`). [AndroidManifest.xml](../android_kiosk/app/src/main/AndroidManifest.xml)에는 현재 `NFC`, `INTERNET`, `CAMERA` 권한만 있고 SMS 관련 권한은 없음. 결제 단말 용도로, WebView 락다운된 전용 기기 (최근 커밋: "Lock down kiosk app for dedicated-device use").

## 3. 검토했던 대안과 결론 (은행 API 연동)

### 3.1 NH 핀테크 오픈API — 거래내역조회 (핀-어카운트)
- URL: https://nhfintech.nonghyup.com/content/svcportal/home/html/UIPD2060.html
- 공개 페이지에는 개요만 있고 (핀-어카운트 연결계좌 입출금 거래내역 제공), 요청/응답 상세 스펙은 회원가입·신청 승인 후에만 열람 가능한 구조로 확인됨. 필드 레벨 확정은 못함.

### 3.2 금융결제원 오픈뱅킹 — 거래내역조회 API (은행 공통 표준, NH 포함)
- URL: https://developers.kftc.or.kr/dev/openapi/open-banking/transaction
- 요청: `from_date`/`to_date`(기간), `from_time`/`to_time`, `inquiry_type`(전체/입금/출금), 페이지당 최대 25건.
- 응답 주요 필드: `tran_amt`(거래금액), `print_content`(통장인자내용/적요, 최대 20자 — **입금자명이 들어있는 경우가 많지만 전용 필드가 아닌 자유 텍스트**, 신뢰도 낮음), `inout_type`, `balance_amt`.
- **입금자 계좌번호·은행 정보는 이 API 응답에 없음** (개인정보 보호상 제공 안 됨).
- 결론: 금액 + (불확실한) 입금자명 정도만 확보 가능. NH 자체 API 대신 이걸 써도 되는지 물었을 때 — 기술적으로 가능(NH 계좌 하나만 "계좌등록"해서 핀테크이용번호 발급받으면 됨)하나, 별도 이용기관 등록·심사가 필요해서 가입 난이도는 NH 자체 API와 비교 검토 필요.

### 3.3 금융결제원 오픈뱅킹 — 송금인정보조회 API
- URL: https://developers.kftc.or.kr/dev/openapi/open-banking/remitter
- 응답 `res_list`에 `remitter_name`(입금자 예금주명), `remitter_bank_code`, `remitter_account_num`, `tran_amt` 등 구조화된 필드로 정확히 존재 — 원하는 정보와 정확히 일치.
- **단, 공식 용도가 "소액해외송금업자의 송금인 신분 확인 의무 이행"으로 명시되어 있어, 일반 국내 충전 서비스가 이 API(scope=`oob`) 이용 신청을 할 자격이 되는지 불확실.** 문서만으로 확정 불가 — 금융결제원에 직접 문의 필요했던 사항.

### 3.4 최종 판단
API 연동(NH 자체 심사, 또는 금융결제원 이용기관 등록·심사, 송금인정보조회 API의 자격 제한 불확실성)의 진입장벽이 높다고 판단 → **은행 API 연동을 포기하고, 휴대폰으로 오는 입금 문자 알림(SMS)을 파싱하는 방식으로 전환하기로 결정.**

## 4. SMS 알림 파싱 방식 — 설계 방향과 트레이드오프

- 은행 앱/통신사가 보내는 입금 알림 문자에는 보통 입금자명 + 금액이 텍스트로 포함되어 있어 필요한 정보와 일치.
- 사업자 등록, 금융결제원 심사, NH 기술문서 승인 등 절차 불필요 — 진입장벽 낮음.
- 트레이드오프: 문자 포맷이 은행/통신사 정책 변경으로 깨질 수 있음(공식 계약 기반이 아님), 수신 기기가 항상 켜져 있고 배터리 최적화에 의해 백그라운드 프로세스가 죽지 않아야 함, SLA/장애 보상 없음.
- 기존 [recharge_matcher.py](../backend/app/services/recharge_matcher.py)의 매칭 로직은 데이터 소스가 SMS로 바뀌어도 그대로 재사용 가능 (결국 `BankTransaction` 레코드를 채우기만 하면 됨).

## 5. 아직 결정되지 않은 사항 (다음 agent가 사용자와 확인 필요)

사용자에게 아래 두 질문을 던졌으나 **답변 없이 보류(dismissed)된 상태** — 이어받는 agent가 반드시 사용자에게 먼저 확인하고 진행해야 함:

1. **문자 알림을 받을 기기가 무엇인가?**
   - (a) 기존 [android_kiosk](../android_kiosk) 앱과 동일 기기에 SMS 리시버를 추가 (그 기기에 SIM이 꽂혀 있고 은행 알림 문자를 받는 번호여야 함)
   - (b) 별도 전용 폰을 두고, SMS 수신 전용 새 경량 앱을 만들어 문자를 파싱해 백엔드로 전송
2. **SMS를 받은 후 백엔드로 전달하는 방식은?**
   - (a) 새 전용 API 엔드포인트 (예: `POST /api/bank/sms-transactions`) — SMS 앱 전용 API 키로 인증, 관리자 수동입력 엔드포인트와 분리해 감사/보안 명확화
   - (b) 기존 관리자 입금 시뮬레이터 엔드포인트(`POST /api/admin/bank-transactions`) 재사용 — 빠르지만 관리자 인증 체계를 SMS 앱에도 넘겨줘야 해서 보안 경계가 흐려짐

이 두 결정에 따라 Android 쪽(신규 앱 vs 기존 kiosk 앱 확장, 권한 구성)과 백엔드 쪽(신규 엔드포인트/인증 설계 여부)의 작업 범위가 달라짐. 구현 착수 전에 반드시 사용자 확인 필요.

## 6. 참고 링크

- NH핀테크 오픈API 포털: https://nhfintech.nonghyup.com/content/svcportal/home/html/UIPD2060.html
- 금융결제원 오픈뱅킹 — 거래내역조회: https://developers.kftc.or.kr/dev/openapi/open-banking/transaction
- 금융결제원 오픈뱅킹 — 입금이체: https://developers.kftc.or.kr/dev/openapi/open-banking/deposit
- 금융결제원 오픈뱅킹 — 송금인정보조회: https://developers.kftc.or.kr/dev/openapi/open-banking/remitter
