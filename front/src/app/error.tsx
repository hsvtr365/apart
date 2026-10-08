"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="m-auto p-6 text-center">
      <h1>화면을 불러오지 못했어요.</h1>
      <button className="btn mt-4" onClick={reset}>
        다시 시도
      </button>
    </main>
  );
}
