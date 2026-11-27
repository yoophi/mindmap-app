# Mindmap

Tauri 2와 React로 만든 로컬 마인드맵 편집기 PoC입니다.

## 실행

Node.js 22+, pnpm 9.10, Rust와 운영체제에 맞는 Tauri 빌드 환경이 필요합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## 조작

- 캔버스나 아웃라인에서 노드를 선택합니다. `Child`와 `Sibling`으로 추가하고, 더블클릭이나 `F2`로 이름을 편집합니다.
- 노드 사이에 드롭하면 형제 순서를 바꿉니다. 루트 가지를 반대쪽 빈 영역에 놓으면 좌우를 바꿉니다. 다른 노드 위에 놓으면 그 노드의 하위로 이동합니다.
- 빈 캔버스를 드래그해 이동하고, 확대·축소 버튼이나 맞춤 버튼으로 보기 크기를 조절합니다.
- `Save`와 `Open`으로 로컬 `.mindmap.json` 문서를 저장하고 다시 엽니다.

## 검증 명령

```sh
pnpm check-types
pnpm build
pnpm test
pnpm --filter @yoophi/mindmap-app build-storybook
```

[구현 계획](docs/mindmap-poc-plan.md)
