import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchDiaries, createDiary, deleteDiary, updateDiary, createDiaryComment, deleteDiaryComment, DiaryEntry, DiaryComment } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { SimpleModal } from '../components/ui/SimpleModal';
import { 
  BookOpen, Trash2, Plus, Calendar, User, MessageCircle, Send, X,
  TrendingUp, TrendingDown, Activity, Users, ChevronDown, ChevronRight, Edit2
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Financial dark theme colors
const theme = {
  bg: 'bg-[#0a0a0a]',
  card: 'bg-[#141414]',
  cardBorder: 'border-[#262626]',
  accent: 'text-[#d4af37]',
  accentBg: 'bg-[#d4af37]',
  accentHover: 'hover:bg-[#c9a432]',
  accentBorder: 'border-[#d4af37]',
  text: 'text-[#fafafa]',
  textMuted: 'text-[#737373]',
  textSecondary: 'text-[#a3a3a3]',
  gradient: 'bg-gradient-to-r from-[#d4af37] to-[#b8962e]',
  success: 'text-green-400',
  danger: 'text-red-400',
};

interface UserSummary {
  userId: number;
  userName: string;
  count: number;
  latestDate: string;
}

export default function DiaryPage() {
  const { user } = useAuth();
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
  });
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showUserList, setShowUserList] = useState(false);
  const [editingDiary, setEditingDiary] = useState<DiaryEntry | null>(null);
  const [editFormData, setEditFormData] = useState({ title: '', content: '' });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadDiaries();
  }, []);

  const loadDiaries = async () => {
    try {
      setIsLoading(true);
      const data = await fetchDiaries();
      setDiaries(data);
    } catch (err) {
      console.error('Failed to load diaries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 사용자별 목차 생성
  const userList: UserSummary[] = useMemo(() => {
    const userMap = new Map<number, UserSummary>();
    
    diaries.forEach(diary => {
      if (!userMap.has(diary.userId)) {
        userMap.set(diary.userId, {
          userId: diary.userId,
          userName: diary.userName || 'Anonymous',
          count: 0,
          latestDate: diary.createdAt,
        });
      }
      const summary = userMap.get(diary.userId)!;
      summary.count++;
      if (new Date(diary.createdAt) > new Date(summary.latestDate)) {
        summary.latestDate = diary.createdAt;
      }
    });
    
    return Array.from(userMap.values()).sort((a, b) => 
      new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
    );
  }, [diaries]);

  // 필터링된 일기
  const filteredDiaries = useMemo(() => {
    if (selectedUserId === null) return diaries;
    return diaries.filter(d => d.userId === selectedUserId);
  }, [diaries, selectedUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setIsSubmitting(true);

    try {
      const newDiary = await createDiary({
        title: formData.title,
        content: formData.content,
      });
      setDiaries([newDiary, ...diaries]);
      setFormData({ title: '', content: '' });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create diary');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDiary = async (id: number) => {
    if (!confirm('Delete this diary entry?')) return;

    try {
      await deleteDiary(id);
      setDiaries(diaries.filter(d => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete diary');
    }
  };

  const handleEditDiary = async () => {
    if (!editingDiary) return;

    try {
      setIsEditing(true);
      const updated = await updateDiary(editingDiary.id, {
        title: editFormData.title,
        content: editFormData.content,
      });
      setDiaries(diaries.map(d => d.id === editingDiary.id ? { ...d, ...updated } : d));
      setEditingDiary(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update diary');
    } finally {
      setIsEditing(false);
    }
  };

  const openEditModal = (diary: DiaryEntry) => {
    setEditingDiary(diary);
    setEditFormData({ title: diary.title, content: diary.content });
  };

  const handleCommentSubmit = async (diaryId: number) => {
    if (!user) return;
    
    const content = commentInputs[diaryId]?.trim();
    if (!content) return;

    try {
      const newComment = await createDiaryComment({ diaryId, content });
      
      setDiaries(diaries.map(d => {
        if (d.id === diaryId) {
          return {
            ...d,
            comments: [...(d.comments || []), newComment],
          };
        }
        return d;
      }));
      
      setCommentInputs(prev => ({ ...prev, [diaryId]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Delete this comment?')) return;

    try {
      await deleteDiaryComment(commentId);
      
      setDiaries(diaries.map(d => ({
        ...d,
        comments: (d.comments || []).filter(c => c.id !== commentId),
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
    }
  };

  const toggleComments = (diaryId: number) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(diaryId)) {
        next.delete(diaryId);
      } else {
        next.add(diaryId);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatShortDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Analyze content for trading indicators
  const getTradingMood = (content: string) => {
    const lowerContent = content.toLowerCase();
    const profitWords = ['profit', 'gain', 'win', 'bull', 'up', 'growth', 'success', '양호', '이익', '상승'];
    const lossWords = ['loss', 'bear', 'down', 'fail', 'decline', '亏损', '손실', '하락'];
    
    const hasProfit = profitWords.some(word => lowerContent.includes(word));
    const hasLoss = lossWords.some(word => lowerContent.includes(word));
    
    if (hasProfit && !hasLoss) return 'profit';
    if (hasLoss && !hasProfit) return 'loss';
    return 'neutral';
  };

  const selectedUser = userList.find(u => u.userId === selectedUserId);

  return (
    <div className={`min-h-screen ${theme.bg}`}>
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a]"></div>
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#d4af37] rounded-full blur-[150px]"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-green-900/30 rounded-full blur-[200px]"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-20">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-xl ${theme.gradient}`}>
              <BookOpen className="w-8 h-8 text-black" />
            </div>
            <span className={`text-sm font-medium ${theme.accent} tracking-wider uppercase`}>
              Trading Journal
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-[#fafafa] mb-4">
            Trading <span className={theme.accent}>Diary</span>
          </h1>
          <p className={`text-lg ${theme.textMuted} max-w-2xl`}>
            Share your trading insights, strategies, and daily reflections with the community.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar - User List */}
          <div className="w-full lg:w-72 shrink-0">
            <Card className={`${theme.card} border ${theme.cardBorder} sticky top-24`}>
              <CardHeader className="pb-3 border-b border-[#262626]">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[#fafafa] flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Members
                  </h3>
                  <span className="text-xs text-[#737373]">{userList.length}</span>
                </div>
              </CardHeader>
              <CardContent className="p-2">
                {/* All entries option */}
                <button
                  onClick={() => setSelectedUserId(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                    selectedUserId === null 
                      ? 'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30' 
                      : 'text-[#a3a3a3] hover:bg-[#1f1f1f] hover:text-[#fafafa]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    All Entries
                  </span>
                  <span className="text-xs">{diaries.length}</span>
                </button>

                {/* User list */}
                <div className="mt-2 space-y-1 max-h-80 overflow-y-auto">
                  {userList.map((userSummary) => (
                    <button
                      key={userSummary.userId}
                      onClick={() => setSelectedUserId(userSummary.userId)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                        selectedUserId === userSummary.userId 
                          ? 'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30' 
                          : 'text-[#a3a3a3] hover:bg-[#1f1f1f] hover:text-[#fafafa]'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <div className="w-6 h-6 rounded-full bg-[#262626] flex items-center justify-center text-xs font-medium">
                          {userSummary.userName.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{userSummary.userName}</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-[#525252]">{userSummary.count}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Selected user header */}
            {selectedUser && (
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#262626] flex items-center justify-center text-sm font-medium text-[#d4af37]">
                    {selectedUser.userName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[#fafafa] font-medium">{selectedUser.userName}'s Entries</span>
                  <span className="text-sm text-[#737373]">({selectedUser.count})</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUserId(null)}
                  className="text-[#737373] hover:text-[#d4af37]"
                >
                  View All
                </Button>
              </div>
            )}

            {/* Write Button */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <Activity className={`w-5 h-5 ${theme.accent}`} />
                <span className={`text-sm ${theme.textMuted}`}>
                  {selectedUser ? `${filteredDiaries.length} entries` : `${diaries.length} entries`}
                </span>
              </div>
              {user && (
                <Button
                  onClick={() => setShowForm(!showForm)}
                  className={`${theme.accentBg} text-black ${theme.accentHover}`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Write Entry
                </Button>
              )}
            </div>

            {/* Write Form */}
            {showForm && (
              <Card className={`mb-8 ${theme.card} border ${theme.cardBorder}`}>
                <CardHeader className="pb-4 border-b border-[#262626]">
                  <h2 className="text-lg font-semibold text-[#fafafa] flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#d4af37]" />
                    New Diary Entry
                  </h2>
                </CardHeader>
                <CardContent className="pt-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                      <Alert variant="destructive" className="bg-red-900/20 border-red-800">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    
                    <div>
                      <Input
                        placeholder="Title (e.g., Today's Trading Summary)"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className={`${theme.card} border ${theme.cardBorder} text-[#fafafa] placeholder:text-[#525252]`}
                        required
                      />
                    </div>
                    
                    <div>
                      <Textarea
                        placeholder="Share your trading thoughts, strategies, lessons learned..."
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        rows={6}
                        className={`${theme.card} border ${theme.cardBorder} text-[#fafafa] placeholder:text-[#525252] resize-none`}
                        required
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className={`${theme.accentBg} text-black ${theme.accentHover}`}
                      >
                        {isSubmitting ? 'Posting...' : 'Post Diary'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowForm(false)}
                        className="border-[#262626] text-[#737373] hover:text-[#fafafa] hover:bg-[#1f1f1f] hover:border-[#404040]"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Not logged in message */}
            {!user && (
              <Card className={`mb-8 ${theme.card} border ${theme.cardBorder}`}>
                <CardContent className="py-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1f1f1f] flex items-center justify-center">
                    <User className="w-8 h-8 text-[#525252]" />
                  </div>
                  <p className={`${theme.textMuted} mb-4`}>Sign in to share your trading diary</p>
                  <Link to="/auth">
                    <Button className={`${theme.accentBg} text-black ${theme.accentHover}`}>
                      Sign In
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Diaries List */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full mx-auto"></div>
                <p className={`mt-4 ${theme.textMuted}`}>Loading diaries...</p>
              </div>
            ) : filteredDiaries.length === 0 ? (
              <Card className={`${theme.card} border ${theme.cardBorder}`}>
                <CardContent className="py-16 text-center">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 text-[#262626]" />
                  <h3 className="text-xl font-semibold text-[#fafafa] mb-2">
                    {selectedUser ? `No entries from ${selectedUser.userName}` : 'No Diary Entries Yet'}
                  </h3>
                  <p className={theme.textMuted}>
                    {selectedUser ? 'This member hasn\'t posted any entries yet.' : 'Be the first to share your trading insights!'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredDiaries.map((diary, index) => {
                  const mood = getTradingMood(diary.content);
                  return (
                    <Card 
                      key={diary.id} 
                      className={`${theme.card} border ${theme.cardBorder} hover:border-[#d4af37]/30 transition-all duration-300`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <CardHeader className="pb-2 border-b border-[#1f1f1f]">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {/* Mood Indicator */}
                              {mood === 'profit' && (
                                <span className="px-2 py-0.5 text-xs bg-green-900/30 text-green-400 rounded-full flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" /> Profit
                                </span>
                              )}
                              {mood === 'loss' && (
                                <span className="px-2 py-0.5 text-xs bg-red-900/30 text-red-400 rounded-full flex items-center gap-1">
                                  <TrendingDown className="w-3 h-3" /> Loss
                                </span>
                              )}
                              {mood === 'neutral' && (
                                <span className="px-2 py-0.5 text-xs bg-[#262626] text-[#a3a3a3] rounded-full flex items-center gap-1">
                                  <Activity className="w-3 h-3" /> Update
                                </span>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold text-[#fafafa]">{diary.title}</h3>
                            <div className="flex items-center gap-4 mt-2 text-sm text-[#737373]">
                              <button 
                                onClick={() => setSelectedUserId(diary.userId)}
                                className="flex items-center gap-1 hover:text-[#d4af37] transition-colors"
                              >
                                <User className="h-3 w-3" />
                                {diary.userName || 'Anonymous'}
                              </button>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(diary.createdAt)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {user && user.id === diary.userId && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditModal(diary)}
                                  className="text-[#737373] hover:text-[#d4af37] hover:bg-[#d4af37]/20"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteDiary(diary.id)}
                                  className="text-[#737373] hover:text-red-500 hover:bg-red-900/20"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-[#a3a3a3] whitespace-pre-wrap mb-4 leading-relaxed">{diary.content}</p>
                        
                        {/* Comments Section */}
                        <div className="border-t border-[#262626] pt-4">
                          <button
                            onClick={() => toggleComments(diary.id)}
                            className={`flex items-center gap-2 text-sm ${theme.textMuted} hover:text-[#d4af37] transition-colors`}
                          >
                            <MessageCircle className="h-4 w-4" />
                            <span>{(diary.comments || []).length} comments</span>
                          </button>

                          {expandedComments.has(diary.id) && (
                            <div className="mt-4 space-y-3">
                              {user && (
                                <div className="flex gap-2 items-start">
                                  <Textarea
                                    placeholder="Write a comment..."
                                    value={commentInputs[diary.id] || ''}
                                    onChange={(e) => setCommentInputs(prev => ({ ...prev, [diary.id]: e.target.value }))}
                                    rows={2}
                                    className={`${theme.card} border ${theme.cardBorder} text-[#fafafa] text-sm flex-1 placeholder:text-[#525252] resize-none`}
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => handleCommentSubmit(diary.id)}
                                    disabled={!commentInputs[diary.id]?.trim()}
                                    className={`${theme.accentBg} text-black ${theme.accentHover} mt-1 h-10`}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}

                              {(diary.comments || []).length > 0 ? (
                                <div className="space-y-2 pl-4 border-l-2 border-[#262626]">
                                  {diary.comments.map((comment) => (
                                    <div key={comment.id} className="bg-[#1f1f1f] rounded-lg p-3">
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <span className="text-sm font-medium text-[#d4af37]">
                                            {comment.userName || 'Anonymous'}
                                          </span>
                                          <span className="text-xs text-[#525252] ml-2">
                                            {formatDate(comment.createdAt)}
                                          </span>
                                        </div>
                                        {user && user.id === comment.userId && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteComment(comment.id)}
                                            className="text-[#525252] hover:text-red-500 p-1 h-auto"
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                      <p className="text-sm text-[#a3a3a3] mt-1">{comment.content}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className={`text-sm ${theme.textMuted} text-center py-2`}>No comments yet. Be the first!</p>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Diary Modal */}
      <SimpleModal
        open={!!editingDiary}
        onClose={() => setEditingDiary(null)}
        title="Edit Diary Entry"
        className="max-w-2xl"
      >
        <div className="space-y-4 mt-4">
          <Input
            placeholder="Title"
            value={editFormData.title}
            onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
            className={`${theme.card} border ${theme.cardBorder} text-[#fafafa] placeholder:text-[#525252]`}
            required
          />
          <Textarea
            placeholder="Content"
            value={editFormData.content}
            onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
            rows={8}
            className={`${theme.card} border ${theme.cardBorder} text-[#fafafa] placeholder:text-[#525252] resize-none`}
            required
          />
          <div className="flex gap-3">
            <Button
              onClick={handleEditDiary}
              disabled={isEditing}
              className={`${theme.accentBg} text-black ${theme.accentHover}`}
            >
              {isEditing ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setEditingDiary(null)}
              className="border-[#262626] text-[#737373] hover:text-[#fafafa] hover:bg-[#1f1f1f] hover:border-[#404040]"
            >
              Cancel
            </Button>
          </div>
        </div>
      </SimpleModal>
    </div>
  );
}
