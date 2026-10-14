import Link from "next/link";
import { SITE_DESCRIPTION } from "@/lib/seo";
import { sources } from "@/lib/sources";
import { Breadcrumbs } from "./breadcrumbs";

export function SiteGuide() {
  return (
    <article className="space-y-6 pb-6 leading-relaxed">
      <Breadcrumbs path="/about" />
      <header>
        <h1 className="page-title">햇빛마을20단지 생활정보 이용 안내</h1>
        <p>
          {SITE_DESCRIPTION} 이웃이 등록한 일정과 현장 확인 정보를 함께 살펴볼
          수 있습니다.
        </p>
      </header>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">어떤 소식을 볼 수 있나요?</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <Link className="text-brand underline" href="/feed/food">
              먹거리 소식
            </Link>
            : 방문 일정과 이웃의 ‘있어요·없어요’ 현장 확인을 볼 수 있습니다.
          </li>
          <li>
            <Link className="text-brand underline" href="/feed/market">
              요일장 소식
            </Link>
            : 등록된 요일·기간과 방문 시간을 확인할 수 있습니다.
          </li>
          <li>
            <Link className="text-brand underline" href="/feed/notice">
              단지 공고
            </Link>
            : 게시글에 등록된 안내 내용과 공고 기간을 확인할 수 있습니다.
          </li>
        </ul>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-bold">자주 묻는 질문</h2>
        <div>
          <h3 className="font-bold">
            오늘 먹거리가 와 있는지 어떻게 확인하나요?
          </h3>
          <p>
            <Link className="text-brand underline" href="/">
              홈의 오늘의 소식
            </Link>
            에서 예정된 방문을 살펴본 뒤, 먹거리 상세의 마지막 확인 시각과
            ‘있어요·없어요’ 기록을 확인하세요. ‘오늘 와요’는 등록된 일정에 따른
            표시이며, 실제 도착을 보장하지 않습니다.
          </p>
        </div>
        <div>
          <h3 className="font-bold">요일장 시간과 위치는 어디서 보나요?</h3>
          <p>
            요일장 게시글의 방문 일정에서 등록된 요일·날짜와 시간을 확인하세요.
            위치가 등록된 소식은{" "}
            <Link className="text-brand underline" href="/map">
              지도
            </Link>
            에서도 찾을 수 있습니다. 현장 사정에 따라 일정이 달라질 수 있습니다.
          </p>
        </div>
        <div>
          <h3 className="font-bold">
            현장 확인과 게시글 날짜는 무엇이 다른가요?
          </h3>
          <p>
            게시글의 작성·수정일은 안내 내용을 등록하거나 바꾼 시각입니다.
            ‘마지막 확인’은 이웃이 현장을 확인한 시각입니다. 오래된 현장 제보를
            현재 영업 상태로 해석하지 마세요.
          </p>
        </div>
        <div>
          <h3 className="font-bold">
            새 소식이나 잘못된 정보를 어떻게 알리나요?
          </h3>
          <p>
            <Link className="text-brand underline" href="/report">
              제보
            </Link>
            에서 로그인한 뒤 먹거리·요일장·공고를 등록할 수 있습니다. 방문
            날짜·시간·위치와 직접 확인한 내용을 적어주세요. 기존 글의 변경
            사항은 댓글로 알려주고, 본인이 작성한 글은 상세 화면에서 수정할 수
            있습니다.
          </p>
        </div>
        <div>
          <h3 className="font-bold">
            공고와 생활정보는 어디까지 믿을 수 있나요?
          </h3>
          <p>
            이 사이트는 이웃이 등록한 정보를 공유합니다. 중요한 일정이나 신청
            조건은 게시글에 안내된 원문 또는 해당 기관에서 다시 확인하세요.
            게시글의 일정과 현장 제보는 실제 방문·영업을 보장하지 않습니다.
          </p>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">지역 생활정보 확인처</h2>
        <p>행정·복지·도서관 소식은 아래 기관의 안내를 확인할 수 있습니다.</p>
        <ul className="space-y-3">
          {sources.slice(0, 4).map((source) => (
            <li key={source.name}>
              <a
                className="text-brand underline"
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.name}
              </a>
              <p className="text-sm text-muted">{source.description}</p>
            </li>
          ))}
        </ul>
      </section>
      <Link className="btn" href="/feed">
        생활 피드 보기
      </Link>
    </article>
  );
}
