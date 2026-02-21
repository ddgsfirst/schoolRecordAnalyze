
# Student Record Analysis API

## Overview

생기부 파일을 업로드하고 교과학습발달상황 데이터를 추출하여\
교과목 점수 계산, 교과군 평균 계산, 학기별 성장 분석을 수행하는 API이다.

------------------------------------------------------------------------

## Base URL

    /api/v1

## Content-Type

    application/json

------------------------------------------------------------------------

# 1. 생기부 업로드

## POST /records

### Description

생기부 파일을 업로드하고 recordId를 생성한다.

### Request

Content-Type: multipart/form-data

  Field       Type     Required   Description
  ----------- -------- ---------- ----------------------
  file        file     Yes        생기부 파일 (PDF 등)
  studentId   string   No         학생 식별 ID

### Response (200)

``` json
{
  "success": true,
  "data": {
    "recordId": "rec_001",
    "status": "uploaded"
  }
}
```

### Error

-   400 Bad Request
-   500 Internal Server Error

------------------------------------------------------------------------

# 2. 교과학습발달상황 파싱

## POST /records/{recordId}/parse

### Description

업로드된 생기부에서 교과학습발달상황 데이터를 추출한다.

### Path Parameter

  Name       Type     Description
  ---------- -------- ------------------
  recordId   string   생성된 record ID

### Response (200)

``` json
{
  "success": true,
  "data": {
    "status": "parsed"
  }
}
```

------------------------------------------------------------------------

# 3. 교과 데이터 조회

## GET /records/{recordId}/curriculum

### Description

파싱된 교과학습발달상황 데이터를 조회한다.

### Response (200)

``` json
{
  "success": true,
  "data": [
    {
      "grade": 1,
      "term": 1,
      "subjectGroup": "수학",
      "subject": "수학Ⅰ",
      "credit": 4,
      "rankGrade": 2,
      "rank": 15,
      "studentCount": 220
    }
  ]
}
```

------------------------------------------------------------------------

# 4. 교과목 점수 계산

## POST /records/{recordId}/calculate

### Description

석차등급, 석차, 수강인원, 이수단위를 기반으로 교과목 성취 점수를
계산한다.

### Calculation Logic

등급 점수 변환:

    gradeScore = (10 - rankGrade) / 9 × 100

Percentile 계산:

    percentile = (1 - rank / studentCount) × 100

이수단위 가중 평균:

    weightedScore = Σ(점수 × 단위) / Σ(단위)

### Response (200)

``` json
{
  "success": true,
  "data": [
    {
      "subject": "수학Ⅰ",
      "gradeScore": 88.9,
      "percentile": 93.2,
      "credit": 4,
      "finalScore": 91.4
    }
  ]
}
```

------------------------------------------------------------------------

# 5. 교과군 단위 분석

## GET /records/{recordId}/subject-group

### Description

과목 점수에 이수단위를 반영하여 교과군 평균 점수를 계산한다.

### Calculation

    groupScore = Σ(과목점수 × 이수단위) / Σ(이수단위)

### Response (200)

``` json
{
  "success": true,
  "data": [
    {
      "subjectGroup": "수학",
      "groupScore": 89.7
    }
  ]
}
```

------------------------------------------------------------------------

# 6. 학기별 성장 분석

## GET /records/{recordId}/trend

### Description

학기별 percentile 변화를 분석하여 상승, 유지, 하락 여부를 판단한다.

### Calculation

    trend = currentPercentile - previousPercentile

### Trend Criteria

-   +5 이상 → 상승\
-   -5 \~ +5 → 유지\
-   -5 이하 → 하락

### Response (200)

``` json
{
  "success": true,
  "data": [
    {
      "subject": "수학Ⅰ",
      "previousPercentile": 82.1,
      "currentPercentile": 90.4,
      "trend": "상승"
    }
  ]
}
```

------------------------------------------------------------------------

# Error Response Format

``` json
{
  "success": false,
  "error": {
    "code": 400,
    "message": "Invalid request"
  }
}
```

------------------------------------------------------------------------

# Overall Flow

1.  생기부 업로드\
2.  교과학습발달상황 파싱\
3.  과목 단위 데이터 저장\
4.  점수 계산\
5.  교과군 평균 계산\
6.  학기별 성장 분석
