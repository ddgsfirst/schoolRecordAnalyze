## Student Record Analysis API (Express)

PDF 생기부를 업로드하고, **교과학습발달상황**에서 교과 성적(석차등급/석차/수강인원/이수단위)을 추출해 계산/분석하는 API입니다.

### 실행

```bash
cd /c/Users/taehwan/Desktop/analyze
npm install
npm run dev
```

기본 포트는 `3000`이고, `PORT=4000 npm run dev`처럼 변경할 수 있습니다.

### API

Base URL: `/api/v1`

#### 1) 생기부 업로드

```bash
curl -s -X POST http://localhost:3000/api/v1/records \
  -F "file=@/path/to/record.pdf" \
  -F "studentId=stu_001"
```

응답에서 `recordId`를 얻습니다.

#### 2) 교과학습발달상황 파싱

```bash
curl -s -X POST http://localhost:3000/api/v1/records/{recordId}/parse
```

#### 3) 교과 데이터 조회

```bash
curl -s http://localhost:3000/api/v1/records/{recordId}/curriculum
```

#### 4) 교과목 점수 계산

```bash
curl -s -X POST http://localhost:3000/api/v1/records/{recordId}/calculate
```

#### 5) 교과군 단위 분석

```bash
curl -s http://localhost:3000/api/v1/records/{recordId}/subject-group
```

#### 6) 학기별 성장 분석

```bash
curl -s http://localhost:3000/api/v1/records/{recordId}/trend
```

### 파싱(중요)

`pdf-parse`로 PDF에서 텍스트를 뽑아낸 뒤, 줄 단위로 정규식/토큰 분해로 행을 추출합니다.

- 구현 위치: `src/v1/services/parser.js`
- 기본적으로 다음 형태를 우선 인식합니다.
  - `학년 학기 교과군 과목 단위 석차등급 석차/수강인원`
  - 혹은 공백/탭으로 구분된 표 형태

생기부 PDF는 학교/출력 방식에 따라 표가 깨지거나 줄바꿈이 달라질 수 있어서, 실제 PDF 샘플에 맞춰 정규식/토큰 규칙을 확장하는 방식으로 정확도를 올리게 됩니다.

### 저장소

- 업로드 파일: `storage/uploads/`
- 레코드 DB(JSON): `storage/db.json`

