import Link from "next/link";
export default function NotFound() {
  return (
    <main className="m-auto p-6 text-center">
      <h1>페이지를 찾을 수 없어요.</h1>
      <Link href="/" className="btn mt-4">
        홈으로 돌아가기
      </Link>
    </main>
  );
}
