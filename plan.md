# Commit Message Court MCP 구현 계획

## 요약
이 프로젝트는 TypeScript 기반 MCP 서버로 동작하며, 커밋 제목과 diff를 법정 심판 형식으로 평가한다. 출력은 법정 판결문 톤을 유지하면서도 구조화된 판정 데이터와 재작성 제안을 함께 제공한다. 점수가 낮은 경우에는 실패 판정과 재작성 요구를 반환해 훅이나 CI에서 차단 신호로 사용할 수 있게 한다.

## 핵심 구현
- 공개 툴은 `court.prosecute_commit`, `court.require_better_subject`, `court.render_verdict` 3개로 고정한다.
- 공통 입력은 `subject`, `body`, `diff`, `pr_body`, `style`, `language`를 사용한다.
- 공통 출력은 `verdict`, `score`, `charges`, `findings`, `evidence`, `sentence`, `required_actions`, 재작성 필드, `rendered_opinion`으로 통일한다.
- 판정 엔진은 메시지 위생 검사, diff 증거 추출, 점수 산정, 판결문 렌더링으로 분리한다.

## 판정 기준
- `fix stuff`, `misc`, `final_final_real` 같은 모호한 제목은 크게 감점한다.
- Conventional Commit 형식을 따르지 않으면 감점한다.
- `auth`, `config`, `migration` 같은 고위험 파일을 건드리면 근거 증거물로 노출한다.
- 의미 있는 변경인데 테스트 근거가 없으면 추가 감점하고 재작성 및 검증 요구를 건다.
- 점수 기준은 `approved`, `probation`, `convicted` 세 단계로 나눈다.

## 테스트
- 모호한 제목이 유죄와 재작성안으로 이어지는지 검증한다.
- 테스트 파일이 포함된 diff가 가점을 받는지 검증한다.
- 판사/검사 스타일 렌더링이 서로 다른지 검증한다.
- MCP 서버가 세 개의 툴을 노출하고 구조화된 판결을 반환하는지 검증한다.
