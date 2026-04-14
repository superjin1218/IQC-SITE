# IQC Field Graph

WorldQuant BRAIN / IQC 알파 설계를 위해 **필드(데이터 시그널) 간의 상관관계와 유사도**를 시각화·탐색하는 정적 웹사이트입니다. 1,008개 필드에 대해 단일 필드 probe 알파를 시뮬레이션한 뒤, 일별 PnL 상관과 필드 설명 임베딩을 혼합해 관계를 분석한 결과를 인터랙티브하게 볼 수 있습니다.

**Live**: Vercel에 배포 후 URL 기입
**Stack**: 순수 정적 사이트 (HTML / CSS / Vanilla JS) — 서버 없음, 빌드 없음

---

## 무엇을 보여주나

총 **840개 시뮬레이션된 필드**를 대상으로 다음 4가지 뷰를 제공합니다.

### 01 GRAPH — PyVis 인터랙티브 네트워크
- 노드 = 필드, 엣지 = 상관이 높거나 낮은 페어
- 클러스터 중심(centroid)은 이름 라벨, 나머지는 hover 시 영문 description 표시
- 마우스 드래그 팬 · 트랙패드 핀치 줌

### 02 MAP — Plotly UMAP 2D 임베딩
- `1 - combined_similarity` 거리 매트릭스를 UMAP으로 2D 프로젝션
- 클러스터별 그레이 계조, centroid는 흰 테두리 링으로 강조
- 드래그 = 팬, 스크롤 = 줌

### 03 HEATMAP — Seaborn 유사도 매트릭스 PNG
- 필드 × 필드 combined similarity heatmap
- 더블클릭으로 리셋, 드래그/핀치/휠로 팬·줌

### 04 GROUPS — 상관관계 기반 그룹 분류
- 4개의 임계값(`≥ 0.10 / 0.25 / 0.35 / 0.50`) 중 선택
- Agglomerative clustering (complete linkage, 거리 = 1 - combined)으로 파티션
- 각 그룹은 지배적 카테고리/서브카테고리로 한 단어 자동 라벨링
- 그룹 클릭 → 멤버를 **fitness 내림차순**으로 테이블 표시
- 상단 export bar에서 `top N / group` 선택 후 CSV 다운로드 가능 — 각 그룹의 fitness 최상위 N개만 추출한 "대표 알파 묶음" CSV

### 사이드바 SEARCH
- `field_id / subcategory / dataset / category` 전 범위 검색 (상위 30개 랭킹)
- 각 결과에 `sharpe · fitness · turnover` 스탯 뱃지
- 클릭 → 현재 뷰(graph/map)에서 해당 노드로 zoom-in + 노란색 하이라이트
- **자세히 보기** 버튼 → 새 탭에 `detail.html?fid=...` 오픈

### detail.html — 필드 상세
- 해당 필드의 self 메타(카테고리/데이터셋/sharpe/fitness/turnover/α count)
- **상관 이웃 테이블** (top 500, combined similarity 내림차순)
- 컬럼: `field / combined / pnl corr / text sim / fitness / sharpe / turnover / category / subcategory / α count`
- 모든 컬럼 헤더 클릭으로 오름차순/내림차순 토글
- 상단 filter input으로 서브필터

---

## 데이터 파이프라인 (생성 경로)

이 저장소는 **결과물만** 담고 있습니다. 생성은 별도 파이프라인에서 수행되며 다음 단계를 거칩니다.

1. **Corpus build** — WQ BRAIN 필드 메타 수집 → 1,086개 drop, 1,008개 kept
2. **Embeddings** — 필드 description 임베딩 (dim=1024)
3. **Cluster (HDBSCAN)** — behavior-based 97 clusters
4. **Representatives** — 각 클러스터 대표 97개 선정
5. **Probe alphas** — 각 필드에 대해 `rank(ts_backfill(X, 20))` 단일 필드 시뮬
6. **Step 4 validation** — WQ 페어 상관 (intra=0.73, inter=0.80)
7. **Main simulation** — 1,008/1,008 완료 (pass=993, pnl=991)
8. **Similarity + graph** — PnL corr × text cos → combined, NetworkX graph + HDBSCAN re-cluster
9. **Visualize** — PyVis HTML, Plotly UMAP, Seaborn heatmap, static site assembly

**유사도 정의**:
```
combined = 0.85 × |pnl_corr| + 0.15 × text_cosine
```
- `pnl_corr`: 일별 PnL 벡터 피어슨 상관 (cross-sectional demean 후)
- `text_cosine`: 필드 description 임베딩 코사인

---

## 프로젝트 구조

```
.
├── index.html              메인 (사이드바 + 뷰 컨테이너)
├── detail.html             필드 상세 페이지
├── assets/
│   ├── style.css           전체 스타일 (다크 모노크롬 테마)
│   ├── main.js             메인 앱 로직 (뷰 스위칭, 검색, 그룹, 팬/줌)
│   ├── detail.js           detail 페이지 로직 (이웃 테이블 정렬/필터)
│   ├── data.json           필드 인덱스 (검색/카테고리용)
│   ├── groups.json         threshold별 그룹 분류 결과
│   └── neighbors/          필드별 top-500 이웃 상관 JSON (840개)
├── views/
│   ├── graph.html          PyVis 네트워크 (iframe)
│   ├── map.html            Plotly UMAP (iframe)
│   └── heatmap.png         Seaborn heatmap
├── vercel.json             Vercel 설정 (정적 자산 캐싱)
└── README.md
```

모든 로직은 클라이언트사이드에서 돌아가며, 서버/API 호출 없이 순수 정적 파일만 로드합니다.

---

## 로컬 실행

```bash
# 이 폴더에서
python3 -m http.server 8080
# 또는
npx serve .
```

브라우저에서 `http://localhost:8080`

---

## Vercel 배포

정적 사이트라 별도 빌드 없이 루트를 그대로 publish하면 됩니다.

```bash
# Vercel CLI 사용
npm i -g vercel
vercel --prod
```

또는 GitHub 연동으로 자동 배포:
1. 이 저장소를 Vercel에서 import
2. **Framework Preset**: `Other` (혹은 `Static`)
3. **Build Command**: (비워둠)
4. **Output Directory**: `.` (루트)
5. Deploy

`vercel.json`에 정적 자산(`/assets/*`, `/views/*`) long-term immutable 캐싱이 설정되어 있어 재방문이 빠릅니다.

---

## 주요 디자인 원칙

- **다크 모노크롬** — 회색 계조 중심, 노란색(`#ffd600`)은 검색 하이라이트에만 사용
- **키보드/마우스/트랙패드 모두 지원** — 드래그 팬, 휠 줌, 핀치 줌, 더블클릭 리셋
- **URL hash 기반 뷰 상태** — `#graph / #map / #heatmap / #groups` 로 딥링크 가능
- **CSV 익스포트 포함** — 다양화된 대표 알파 묶음 그대로 WQ 플랫폼 붙여넣기 가능 (expr 컬럼 포함)

---

## 라이선스

개인 연구용 — 필드 설명 및 데이터는 WorldQuant BRAIN 플랫폼 기반이며, 유사도/시뮬 결과는 본인의 알파 연구 산출물입니다.
