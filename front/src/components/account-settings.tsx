"use client";
import { useState } from "react";
import { useDetailDialog } from "./use-detail-dialog";
import { useVillage, request } from "./store";
import { Icon } from "./icons";
export function AccountSettings({ onClose }: { onClose: () => void }) {
  const dialog = useDetailDialog(onClose);
  const { data, act, reload, notify } = useVillage();
  const [screen, setScreen] = useState<"menu" | "terms" | "withdraw">("menu");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <dialog {...dialog} className="detail-dialog" aria-label="계정 설정">
      <div className="post-detail-header">
        <h1 className="post-detail-title">
          {screen === "menu"
            ? "계정 설정"
            : screen === "terms"
              ? "이용약관"
              : "회원 탈퇴"}
        </h1>
        <button
          className="icon-btn"
          aria-label="설정 닫기"
          disabled={pending}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="detail-body">
        {screen !== "menu" && (
          <button
            className="icon-btn text-muted"
            disabled={pending}
            onClick={() => {
              setScreen("menu");
              setError("");
            }}
          >
            ← 설정으로
          </button>
        )}
        {screen === "menu" ? (
          <div className="account-settings-menu">
            <button
              className="row w-full text-left"
              onClick={() => setScreen("terms")}
            >
              이용약관
            </button>
            <button
              className="row w-full text-left"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await act("logout");
                  onClose();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setPending(false);
                }
              }}
            >
              로그아웃
            </button>
            <button
              className="row mt-4 w-full text-left text-muted"
              onClick={() => setScreen("withdraw")}
            >
              회원 탈퇴
            </button>
          </div>
        ) : screen === "terms" ? (
          <div className="space-y-3 py-3">
            <h2>서비스 이용 안내</h2>
            <p>
              이웃이 등록한 먹거리·요일장·공고와 현장 확인 정보를 공유합니다.
              일정과 현장 제보는 실제 방문이나 영업을 보장하지 않습니다.
            </p>
            <p>
              개인정보 노출, 타인의 권리 침해, 도배 등 부적절한 게시물은
              운영자가 숨기거나 삭제할 수 있습니다.
            </p>
            <p>
              탈퇴하면 글·댓글은 ‘탈퇴한 이용자’로 유지하고 카카오 연동
              ID·동·로그인 정보는 삭제하고 좋아요와 활동 기록은 유지합니다.
              게시물 본문이나 사진에 직접 적은 개인정보는 탈퇴 전에 수정하거나
              삭제해주세요.
            </p>
            <p className="text-muted">
              닉네임 변경 로그는 1년 보관하며 탈퇴 시 과거 닉네임을 삭제합니다.
              반복 가입 및 중복 좋아요 방지를 위한 식별값은
              탈퇴 후 1년 보관합니다. 정식 이용약관과 개인정보 처리방침은 준비
              중입니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-3">
            <h2>정말 탈퇴하시겠어요?</h2>
            <p>
              글·댓글은 남으며 작성자는 ‘탈퇴한 이용자’로 표시됩니다. 현장 확인
              기록의 닉네임도 같은 이름으로 표시됩니다.
            </p>
            <p>
              카카오 연동 ID·동·로그인 정보는 삭제됩니다. 탈퇴 계정과
              글·댓글·좋아요·현장 확인 기록은 유지되며 재가입 시 이전 계정의
              권한은 복구되지 않습니다. 본문과 사진에 직접 적은 개인정보는 탈퇴
              전에 수정하거나 삭제해주세요.
            </p>
            <p>
              부정 이용 방지용 식별값은 탈퇴 후 1년간
              보관됩니다. 카카오 연결은 카카오 계정의 연결된 서비스 관리에서
              별도로 해제해주세요.
            </p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              위 내용을 확인했습니다.
            </label>
            <button
              className="btn"
              disabled={!confirmed || pending || data?.mode === "demo"}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await request("/api/account", {
                    method: "DELETE",
                    body: JSON.stringify({ confirm: true }),
                  });
                  await reload();
                  notify("회원 탈퇴가 완료됐어요.");
                  onClose();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "처리 중…" : "탈퇴하기"}
            </button>
            {data?.mode === "demo" && (
              <p>데모에서는 실제 탈퇴를 처리하지 않습니다.</p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="py-3 text-red-700">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}
