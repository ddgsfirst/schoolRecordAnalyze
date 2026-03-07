## Student Record Analysis API

생기부 파일을 업로드하고 교과학습발달상황 데이터를 추출해
교과목 점수, 교과군 평균, 학기별 성장 추세를 분석하는 API입니다.

## Run

```bash
npm install
npm run dev
```

기본 포트는 `3000`입니다.

## Base URL

`/api/v1`

## Overall Flow

1. `POST /records` 업로드
2. `POST /records/{recordId}/parse` 파싱
3. `GET /records/{recordId}/curriculum` 교과 데이터 조회
4. `POST /records/{recordId}/calculate` 과목 점수 계산
5. `GET /records/{recordId}/subject-group` 교과군 평균
6. `GET /records/{recordId}/trend` 학기별 성장 분석
7. `GET /records/{recordId}/analysis` 통합 조회(확장)

## Endpoints

### 1) Upload

```bash
curl -s -X POST http://localhost:3000/api/v1/records \
  -F "file=@/path/to/record.pdf" \
  -F "studentId=stu_001"
```

역할:

- 파일 저장
- `recordId` 발급
- 상태를 `uploaded`로 기록

### 2) Parse

```bash
curl -s -X POST http://localhost:3000/api/v1/records/{recordId}/parse
```

역할:

- PDF 텍스트 레이어 파싱
- 필요 시 OCR fallback
- 교과행(`curriculum`) 저장
- 경고(`parseWarnings`) 저장

### 3) Curriculum

```bash
curl -s http://localhost:3000/api/v1/records/{recordId}/curriculum
```

역할:

- 파싱된 원본 교과행만 반환

### 4) Calculate

```bash
curl -s -X POST http://localhost:3000/api/v1/records/{recordId}/calculate
```

역할:

- 과목별 `gradeScore`, `percentile`, `finalScore` 계산

### 5) Subject Group

```bash
curl -s http://localhost:3000/api/v1/records/{recordId}/subject-group
```

역할:

- 교과군별 가중 평균(`groupScore`) 계산

### 6) Trend

```bash
curl -s http://localhost:3000/api/v1/records/{recordId}/trend
```

역할:

- 과목별 최근 2개 시점 percentile 변화로 `상승/유지/하락` 판정

### 7) Analysis (Optional Consolidated)

```bash
curl -s http://localhost:3000/api/v1/records/{recordId}/analysis
```

역할:

- `curriculum`, `subjectScores`, `subjectGroupScores`, `trends`를 한 번에 반환
- `byYearTerm`(학년/학기별 묶음) 제공

## 용어 사전 (Response Field Glossary)

공통:

- `success`: 요청 성공 여부
- `data`: 실제 응답 본문
- `recordId`: 업로드 건 식별자
- `status`: 처리 상태 (`uploaded`, `parsed`)
- `parseWarnings`: 파싱 경고 목록

교과 원본(`curriculum`) 행:

- `grade`: 학년
- `term`: 학기
- `subjectGroup`: 교과군
- `subject`: 과목명
- `credit`: 이수단위
- `rankGrade`: 석차등급(1~9, 추출 실패/없음 시 0 또는 null 가능)
- `rank`: 석차(등수, 없으면 null)
- `studentCount`: 수강 인원

점수(`subjectScores`) 행:

- `gradeScore`: 등급 점수
- `percentile`: 백분위(석차 기반 또는 등급 기반 근사)
- `finalScore`: 최종 과목 점수

교과군(`subjectGroupScores`) 행:

- `groupScore`: 교과군 가중 평균 점수

성장(`trends`) 행:

- `previousPercentile`: 직전 percentile
- `currentPercentile`: 현재 percentile
- `trend`: `상승`, `유지`, `하락`

통합(`byYearTerm`) 묶음:

- `grade`, `term`: 해당 학년/학기
- `curriculum`: 해당 구간 원본 행
- `subjectScores`: 해당 구간 점수 행
- `subjectGroupScores`: 해당 구간 교과군 점수

## 계산 로직

`calculate`:

```text
gradeScore = ((10 - rankGrade) / 9) * 100
percentile(석차 존재) = (1 - rank / studentCount) * 100
percentile(석차 없음) = 등급 구간 중앙값 근사
finalScore = 평균(gradeScore, percentile) 또는 존재값 단독 사용
```

`subject-group`:

```text
groupScore = Σ(finalScore * credit) / Σ(credit)
```

`trend`:

```text
delta = currentPercentile - previousPercentile
delta >= 5 => 상승
delta <= -5 => 하락
그 외 => 유지
```

## 현재 응답 기준 주요 문제점

1. 부분 학년 추출

- `Only partial grades were extracted` 경고처럼 1/2/3학년 전체가 안 잡힐 수 있음.

2. OCR 노이즈 행 포함

- 예: 학교명/날짜 라인이 과목행으로 잘못 들어오는 케이스.

3. 과목명 오인식

- 예: `영이`, `수학ｌ`, `| 프로그래밍`, `6 프로그래밍 화면`.
- 동일 과목이 다른 문자열로 분리되어 trend/집계 정확도 하락.

4. `rank` 결손

- `rank`가 null이면 percentile이 근사치 위주가 되어 정밀 분석에 한계.

5. 비정상 단위/값 유입 가능

- OCR 오인식으로 `credit`, `studentCount`가 비상식 값으로 들어올 수 있음.

## 운영 권장사항

- `parseWarnings`가 있으면 결과를 신뢰도 낮음으로 표시.
- 사용자 노출 전 교과행 검증(노이즈 제거, 과목명 정규화) 단계 추가 권장.
- 성장 분석은 동일 과목명 정규화 후 계산 권장.

## Storage

- Uploaded files: `storage/uploads/`
- JSON DB: `storage/db.json`
