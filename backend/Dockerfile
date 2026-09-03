FROM python:3.11-slim

WORKDIR /app

# 시스템 라이브러리 설치
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# requirements.txt 복사 및 pip 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# entrypoint 래퍼는 /app(=bind mount 지점) 바깥에 둬서 마운트에 가려지지 않게 한다.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 애플리케이션 코드 복사
COPY . .

EXPOSE 8000

# 워커 4개: 조회 부하 테스트(2026-09)에서 워커 1개가 요청당 직렬 CPU(ORM 하이드레이션 +
# Pydantic 직렬화)로 포화돼 처리율이 막히는 게 확인됨. 실서버가 VM.Standard.A1.Flex
# (2 OCPU Arm / 12GB, swap 0)이라 RAM은 여유가 크고 2코어에 4워커는 DB I/O 대기 구간을
# 겹쳐 쓰기 위한 적정 오버서브스크립션. DB 풀은 database.py에서 워커당 10+10=20으로 잡아
# 4워커 x 20 = 80 <= postgres max_connections(100).
# NOTE: --limit-max-requests(워커 주기적 재기동)는 옛 1GB 박스의 메모리 증가 방지용이었으나,
# 부하 중 재기동 순간 nginx 502가 새는 게 확인돼(2026-09) 제거함 - 12GB/swap 0이라 불필요.
# ENTRYPOINT: bind mount(./backend:/app)가 채워질 때까지 기다렸다가 아래 CMD 를 exec 한다
# (docker-entrypoint.sh 주석 참고). 인자는 CMD 한 곳에서만 관리.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
