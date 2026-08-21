import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  CommunityPost, CommunityComment,
  fetchCommunityPosts, fetchCommunityPost,
  createCommunityPost, deleteCommunityPost,
  createCommunityComment, deleteCommunityComment,
} from '../lib/api';

const CATEGORIES = ['전략 공유', '질문', '잡담'] as const;

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function CommunityPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('all');
  const [showWrite, setShowWrite] = useState(false);
  const [writeTitle, setWriteTitle] = useState('');
  const [writeContent, setWriteContent] = useState('');
  const [writeCategory, setWriteCategory] = useState<string>('전략 공유');
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdmin = user?.role === 'admin';

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchCommunityPosts(category === 'all' ? undefined : category);
      setPosts(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const openPost = async (post: CommunityPost) => {
    try {
      const data = await fetchCommunityPost(post.id);
      setSelectedPost(data.post);
      setComments(data.comments);
      setCommentText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '글을 불러오지 못했습니다');
    }
  };

  const closePost = () => {
    setSelectedPost(null);
    setComments([]);
  };

  const submitPost = async () => {
    if (!user) { setError('로그인이 필요합니다'); return; }
    if (!writeTitle.trim() || !writeContent.trim()) { setError('제목과 내용을 입력해주세요'); return; }
    setBusy(true);
    setError(null);
    try {
      await createCommunityPost({ title: writeTitle.trim(), content: writeContent.trim(), category: writeCategory });
      setWriteTitle('');
      setWriteContent('');
      setShowWrite(false);
      await loadPosts();
    } catch (e) {
      setError(e instanceof Error ? e.message : '글 등록 실패');
    } finally {
      setBusy(false);
    }
  };

  const removePost = async (postId: number) => {
    if (!window.confirm('이 글을 삭제할까요?')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCommunityPost(postId);
      if (selectedPost?.id === postId) closePost();
      await loadPosts();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setBusy(false);
    }
  };

  const submitComment = async () => {
    if (!user) { setError('로그인이 필요합니다'); return; }
    if (!selectedPost || !commentText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createCommunityComment(selectedPost.id, commentText.trim());
      setCommentText('');
      const data = await fetchCommunityPost(selectedPost.id);
      setComments(data.comments);
      setSelectedPost(data.post);
    } catch (e) {
      setError(e instanceof Error ? e.message : '댓글 등록 실패');
    } finally {
      setBusy(false);
    }
  };

  const removeComment = async (commentId: number) => {
    if (!window.confirm('이 댓글을 삭제할까요?')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCommunityComment(commentId);
      if (selectedPost) {
        const data = await fetchCommunityPost(selectedPost.id);
        setComments(data.comments);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '댓글 삭제 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#111111]">커뮤니티</h1>
          <p className="text-sm text-[#6b7280] mt-1">전략을 나누고, 질문하고, 매매 이야기를 나누는 공간입니다.</p>
        </div>
        {user && (
          <button
            onClick={() => { setShowWrite(!showWrite); setError(null); }}
            className="px-4 py-2 bg-[#a9823a] hover:bg-[#8f6d2c] text-white text-sm rounded transition-colors"
          >
            {showWrite ? '닫기' : '글쓰기'}
          </button>
        )}
      </div>

      {!user && (
        <div className="bg-[#f5efe0] border border-[#e0d5b8] rounded-lg px-4 py-3 text-sm text-[#4b5563] mb-4">
          글을 남기려면 로그인이 필요합니다.
        </div>
      )}

      {showWrite && user && (
        <div className="border border-[#e5e7eb] rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-3 mb-3">
            <input
              value={writeTitle}
              onChange={(e) => setWriteTitle(e.target.value)}
              placeholder="제목"
              maxLength={200}
              className="flex-1 min-w-[200px] border border-[#d1d5db] rounded px-3 py-2 text-sm"
            />
            <select
              value={writeCategory}
              onChange={(e) => setWriteCategory(e.target.value)}
              className="border border-[#d1d5db] rounded px-2 py-2 text-sm bg-white"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <textarea
            value={writeContent}
            onChange={(e) => setWriteContent(e.target.value)}
            placeholder="알고리즘이나 전략을 공유해주세요. 다른 사람의 매매 판단에 도움이 되는 내용이면 좋겠습니다."
            rows={5}
            maxLength={10000}
            className="w-full border border-[#d1d5db] rounded px-3 py-2 text-sm resize-y"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={submitPost}
              disabled={busy}
              className="px-4 py-2 bg-[#a9823a] hover:bg-[#8f6d2c] text-white text-sm rounded disabled:opacity-50"
            >
              {busy ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      )}

      {error && <div className="bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] text-sm rounded px-3 py-2 mb-4">{error}</div>}

      {/* 카테고리 필터 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setCategory('all')}
          className={`px-3 py-1.5 text-sm rounded-full border ${category === 'all' ? 'bg-[#111111] text-white border-[#111111]' : 'border-[#d1d5db] text-[#4b5563] hover:border-[#a9823a]'}`}
        >
          전체
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 text-sm rounded-full border ${category === c ? 'bg-[#111111] text-white border-[#111111]' : 'border-[#d1d5db] text-[#4b5563] hover:border-[#a9823a]'}`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 글 목록 */}
      {loading ? (
        <div className="text-center text-sm text-[#6b7280] py-10">불러오는 중...</div>
      ) : posts.length === 0 ? (
        <div className="text-center text-sm text-[#6b7280] py-10">아직 글이 없습니다. 첫 글을 남겨보세요.</div>
      ) : (
        <ul className="divide-y divide-[#e5e7eb] border-y border-[#e5e7eb]">
          {posts.map((p) => (
            <li key={p.id} className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f5efe0] text-[#8f6d2c]">{p.category}</span>
                <span className="text-xs text-[#6b7280]">{p.userName}</span>
                <span className="text-xs text-[#9ca3af]">{formatTime(p.createdAt)}</span>
                {isAdmin && (
                  <button
                    onClick={() => removePost(p.id)}
                    disabled={busy}
                    className="ml-auto text-xs text-[#b91c1c] hover:underline"
                  >
                    삭제
                  </button>
                )}
              </div>
              <button onClick={() => openPost(p)} className="text-left w-full">
                <h3 className="font-medium text-[#111111] hover:text-[#8f6d2c]">{p.title}</h3>
                <p className="text-sm text-[#6b7280] mt-1 line-clamp-2 whitespace-pre-line">{p.content}</p>
              </button>
              <div className="text-xs text-[#9ca3af] mt-2">댓글 {p.commentCount}</div>
            </li>
          ))}
        </ul>
      )}

      {/* 상세 (글 + 댓글) */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center overflow-y-auto z-50 p-4" onClick={closePost}>
          <div className="bg-white rounded-lg max-w-2xl w-full mt-10 mb-10 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f5efe0] text-[#8f6d2c]">{selectedPost.category}</span>
                <span className="text-xs text-[#6b7280]">{selectedPost.userName}</span>
                <span className="text-xs text-[#9ca3af]">{formatTime(selectedPost.createdAt)}</span>
              </div>
              <button onClick={closePost} className="text-[#6b7280] hover:text-[#111111] text-lg leading-none">×</button>
            </div>
            <h2 className="text-lg font-semibold text-[#111111] mb-3">{selectedPost.title}</h2>
            <p className="text-sm text-[#374151] whitespace-pre-line leading-relaxed mb-6">{selectedPost.content}</p>

            {(isAdmin || user?.id === selectedPost.userId) && (
              <button
                onClick={() => removePost(selectedPost.id)}
                disabled={busy}
                className="text-xs text-[#b91c1c] hover:underline mb-4"
              >
                이 글 삭제
              </button>
            )}

            <div className="border-t border-[#e5e7eb] pt-4">
              <h4 className="text-sm font-medium text-[#111111] mb-3">댓글 {comments.length}</h4>
              <ul className="space-y-3 mb-4">
                {comments.map((cm) => (
                  <li key={cm.id} className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="text-xs text-[#6b7280]">{cm.userName} · {formatTime(cm.createdAt)}</div>
                      <div className="text-sm text-[#374151] mt-0.5">{cm.content}</div>
                    </div>
                    {(isAdmin || user?.id === cm.userId) && (
                      <button
                        onClick={() => removeComment(cm.id)}
                        disabled={busy}
                        className="text-xs text-[#b91c1c] hover:underline"
                      >
                        삭제
                      </button>
                    )}
                  </li>
                ))}
                {comments.length === 0 && <li className="text-sm text-[#9ca3af]">아직 댓글이 없습니다.</li>}
              </ul>

              {user ? (
                <div className="flex gap-2">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitComment(); }}
                    placeholder="댓글을 입력하세요"
                    maxLength={2000}
                    className="flex-1 border border-[#d1d5db] rounded px-3 py-2 text-sm"
                  />
                  <button
                    onClick={submitComment}
                    disabled={busy || !commentText.trim()}
                    className="px-4 py-2 bg-[#a9823a] hover:bg-[#8f6d2c] text-white text-sm rounded disabled:opacity-50"
                  >
                    등록
                  </button>
                </div>
              ) : (
                <div className="text-sm text-[#6b7280]">댓글을 남기려면 로그인이 필요합니다.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
