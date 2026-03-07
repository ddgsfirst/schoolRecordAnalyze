function round1(x) {
  return Math.round(x * 10) / 10;
}

function percentileFromRankGrade(rankGrade) {
  // 석차등급(1~9) → 누적비율 구간의 "중앙값"으로 근사
  // 1:0~4, 2:4~11, 3:11~23, 4:23~40, 5:40~60, 6:60~77, 7:77~89, 8:89~96, 9:96~100
  const bands = {
    1: [0, 4],
    2: [4, 11],
    3: [11, 23],
    4: [23, 40],
    5: [40, 60],
    6: [60, 77],
    7: [77, 89],
    8: [89, 96],
    9: [96, 100],
  };
  const b = bands[rankGrade];
  if (!b) return null;
  return (b[0] + b[1]) / 2;
}

export function calculateSubjectScores(curriculumRows) {
  return curriculumRows.map((r) => {
    const hasRankGrade = typeof r.rankGrade === "number" && r.rankGrade > 0;
    const hasRank = typeof r.rank === "number" && typeof r.studentCount === "number" && r.studentCount > 0;

    const gradeScore = hasRankGrade ? ((10 - r.rankGrade) / 9) * 100 : null;
    const percentileExact = hasRank ? (1 - r.rank / r.studentCount) * 100 : null;
    const percentileApprox = !hasRank && hasRankGrade ? percentileFromRankGrade(r.rankGrade) : null;
    const percentile = percentileExact ?? percentileApprox;

    const finalScore =
      gradeScore != null && percentile != null
        ? (gradeScore + percentile) / 2
        : (gradeScore ?? percentile);

    return {
      grade: r.grade,
      term: r.term,
      subjectGroup: r.subjectGroup,
      subject: r.subject,
      credit: r.credit,
      rankGrade: r.rankGrade,
      rank: r.rank,
      studentCount: r.studentCount,
      gradeScore: gradeScore == null ? null : round1(gradeScore),
      percentile: percentile == null ? null : round1(percentile),
      finalScore: finalScore == null ? null : round1(finalScore),
    };
  });
}

export function calculateSubjectGroupScores(subjectScores) {
  const byGroup = new Map();
  for (const s of subjectScores) {
    if (s.finalScore == null) continue;
    const key = s.subjectGroup;
    const prev = byGroup.get(key) ?? { sum: 0, credits: 0 };
    byGroup.set(key, {
      sum: prev.sum + s.finalScore * s.credit,
      credits: prev.credits + s.credit,
    });
  }

  return [...byGroup.entries()].map(([subjectGroup, v]) => ({
    subjectGroup,
    groupScore: v.credits > 0 ? round1(v.sum / v.credits) : null,
  }));
}

function trendLabel(delta) {
  if (delta >= 5) return "상승";
  if (delta <= -5) return "하락";
  return "유지";
}

export function calculateTrends(subjectScores) {
  // 같은 과목(subject) 기준으로 학기(grade,term) 순 정렬 후 마지막 2개만 비교
  const bySubject = new Map();
  for (const s of subjectScores) {
    if (s.percentile == null) continue;
    const key = s.subject;
    const arr = bySubject.get(key) ?? [];
    arr.push(s);
    bySubject.set(key, arr);
  }

  const result = [];
  for (const [subject, arr] of bySubject.entries()) {
    arr.sort((a, b) => (a.grade - b.grade) || (a.term - b.term));
    if (arr.length < 2) continue;
    const prev = arr[arr.length - 2];
    const curr = arr[arr.length - 1];
    const delta = curr.percentile - prev.percentile;
    result.push({
      subject,
      previousPercentile: prev.percentile,
      currentPercentile: curr.percentile,
      trend: trendLabel(delta),
    });
  }

  return result;
}

