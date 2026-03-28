import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  fetchAllLectures, createLecture, updateLecture, deleteLecture, fetchAllNotices, createNotice, updateNotice, deleteNotice, setUserAsAdmin, getCurrentUserFromAPI, setCurrentUser,
  type Lecture, type Notice 
} from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { SimpleModal } from '../components/ui/SimpleModal';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  GraduationCap, Bell, Plus, Trash2, Edit, Eye, EyeOff, Play, 
  Calendar, User, Video, FileText, X, Check 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

// Financial dark theme colors
const theme = {
  bg: 'bg-[#0a0a0a]',
  card: 'bg-[#141414]',
  cardBorder: 'border-[#262626]',
  accent: 'text-[#d4af37]',
  accentBg: 'bg-[#d4af37]',
  accentHover: 'hover:bg-[#c9a432]',
  text: 'text-[#fafafa]',
  textMuted: 'text-[#737373]',
  input: 'bg-[#1f1f1f] border-[#262626]',
};

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Admin check
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else if (user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Lecture form state
  const [lectureDialogOpen, setLectureDialogOpen] = useState(false);
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);
  const [lectureForm, setLectureForm] = useState({
    title: '',
    description: '',
    content: '',
    thumbnail: '',
    videoUrl: '',
    duration: '',
    instructor: '',
    isPublished: false,
  });

  // Notice form state
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    content: '',
    isPublished: false,
  });

  useEffect(() => {
    const checkAdmin = async () => {
      // Fetch latest user data from server to ensure role is correct
      try {
        const latestUser = await getCurrentUserFromAPI();
        setCurrentUser(latestUser);
        if (latestUser.role === 'admin') {
          loadData();
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
        if (user && user.role === 'admin') {
          loadData();
        }
      }
    };
    
    if (user) {
      checkAdmin();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError('');
      const [lecturesData, noticesData] = await Promise.all([
        fetchAllLectures(),
        fetchAllNotices(),
      ]);
      setLectures(lecturesData);
      setNotices(noticesData);
    } catch (err) {
      console.error('Failed to load data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data. Please make sure you are logged in as admin.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const showMessage = (msg: string, isError = false) => {
    setError('');
    setSuccess('');
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 3000);
  };

  // Lecture handlers
  const handleLectureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLecture) {
        await updateLecture(editingLecture.id, lectureForm);
        showMessage('Lecture updated successfully');
      } else {
        await createLecture(lectureForm);
        showMessage('Lecture created successfully');
      }
      setLectureDialogOpen(false);
      resetLectureForm();
      loadData();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to save lecture', true);
    }
  };

  const handleDeleteLecture = async (id: number) => {
    if (!confirm('Delete this lecture?')) return;
    try {
      await deleteLecture(id);
      showMessage('Lecture deleted');
      loadData();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to delete lecture', true);
    }
  };

  const openLectureEdit = (lecture: Lecture) => {
    setEditingLecture(lecture);
    setLectureForm({
      title: lecture.title,
      description: lecture.description || '',
      content: lecture.content || '',
      thumbnail: lecture.thumbnail || '',
      videoUrl: lecture.videoUrl || '',
      duration: lecture.duration || '',
      instructor: lecture.instructor || '',
      isPublished: lecture.isPublished,
    });
    setLectureDialogOpen(true);
  };

  const resetLectureForm = () => {
    setEditingLecture(null);
    setLectureForm({
      title: '',
      description: '',
      content: '',
      thumbnail: '',
      videoUrl: '',
      duration: '',
      instructor: '',
      isPublished: false,
    });
  };

  // Notice handlers
  const handleNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingNotice) {
        await updateNotice(editingNotice.id, noticeForm);
        showMessage('Notice updated successfully');
      } else {
        await createNotice(noticeForm);
        showMessage('Notice created successfully');
      }
      setNoticeDialogOpen(false);
      resetNoticeForm();
      loadData();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to save notice', true);
    }
  };

  const handleDeleteNotice = async (id: number) => {
    if (!confirm('Delete this notice?')) return;
    try {
      await deleteNotice(id);
      showMessage('Notice deleted');
      loadData();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to delete notice', true);
    }
  };

  const openNoticeEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setNoticeForm({
      title: notice.title,
      content: notice.content,
      isPublished: notice.isPublished,
    });
    setNoticeDialogOpen(true);
  };

  const resetNoticeForm = () => {
    setEditingNotice(null);
    setNoticeForm({
      title: '',
      content: '',
      isPublished: false,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleMakeAdmin = async () => {
    try {
      await setUserAsAdmin();
      showMessage('You are now an admin! Please refresh or re-login.');
      // Refresh user data
      window.location.reload();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to become admin', true);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className={`min-h-screen ${theme.bg} ${theme.text} flex items-center justify-center`}>
        <Card className={`${theme.card} border ${theme.cardBorder} max-w-md`}>
          <CardContent className="pt-6 text-center">
            <p className={`mb-4 ${theme.textMuted}`}>You are not an admin.</p>
            <Button
              onClick={handleMakeAdmin}
              className={`${theme.accentBg} text-black ${theme.accentHover}`}
            >
              Become Admin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#fafafa]">Admin Dashboard</h1>
          <p className={`${theme.textMuted} mt-2`}>Manage lectures and notices</p>
        </div>

        {/* Messages */}
        {error && (
          <Alert variant="destructive" className="mb-6 bg-red-900/20 border-red-800">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-6 bg-green-900/20 border-green-800">
            <AlertDescription className="text-green-400">{success}</AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <Tabs defaultValue="lectures" className="w-full">
          <TabsList className={`grid w-full max-w-md grid-cols-2 ${theme.card} border ${theme.cardBorder}`}>
            <TabsTrigger 
              value="lectures" 
              className="data-[state=active]:bg-[#d4af37] data-[state=active]:text-black text-[#737373]"
            >
              <GraduationCap className="w-4 h-4 mr-2" />
              Lectures
            </TabsTrigger>
            <TabsTrigger 
              value="notices"
              className="data-[state=active]:bg-[#d4af37] data-[state=active]:text-black text-[#737373]"
            >
              <Bell className="w-4 h-4 mr-2" />
              Notices
            </TabsTrigger>
          </TabsList>

          {/* Lectures Tab */}
          <TabsContent value="lectures" className="mt-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[#fafafa]">Lecture Management</h2>
              <Button
                onClick={() => { resetLectureForm(); setLectureDialogOpen(true); }}
                className={`${theme.accentBg} text-black ${theme.accentHover}`}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Lecture
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-[#737373]">Loading...</div>
            ) : lectures.length === 0 ? (
              <Card className={`${theme.card} border ${theme.cardBorder}`}>
                <CardContent className="py-12 text-center text-[#737373]">
                  <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No lectures yet. Create your first lecture!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {lectures.map((lecture) => (
                  <Card key={lecture.id} className={`${theme.card} border ${theme.cardBorder} hover:border-[#d4af37]/30 transition-colors`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-20 h-14 bg-[#1f1f1f] rounded flex items-center justify-center overflow-hidden">
                            {lecture.thumbnail ? (
                              <img src={lecture.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Video className="w-6 h-6 text-[#262626]" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-[#fafafa]">{lecture.title}</h3>
                              {lecture.isPublished ? (
                                <span className="px-2 py-0.5 text-xs bg-green-900/30 text-green-400 rounded-full flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Published
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs bg-yellow-900/30 text-yellow-400 rounded-full flex items-center gap-1">
                                  <EyeOff className="w-3 h-3" /> Draft
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-[#737373]">
                              {lecture.instructor && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {lecture.instructor}
                                </span>
                              )}
                              {lecture.duration && (
                                <span className="flex items-center gap-1">
                                  <Play className="w-3 h-3" />
                                  {lecture.duration}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(lecture.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openLectureEdit(lecture)}
                            className="text-[#737373] hover:text-[#d4af37] hover:bg-[#d4af37]/10"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteLecture(lecture.id)}
                            className="text-[#737373] hover:text-red-500 hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Notices Tab */}
          <TabsContent value="notices" className="mt-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[#fafafa]">Notice Management</h2>
              <Button
                onClick={() => { resetNoticeForm(); setNoticeDialogOpen(true); }}
                className={`${theme.accentBg} text-black ${theme.accentHover}`}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Notice
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-[#737373]">Loading...</div>
            ) : notices.length === 0 ? (
              <Card className={`${theme.card} border ${theme.cardBorder}`}>
                <CardContent className="py-12 text-center text-[#737373]">
                  <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No notices yet. Create your first notice!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {notices.map((notice) => (
                  <Card key={notice.id} className={`${theme.card} border ${theme.cardBorder} hover:border-[#d4af37]/30 transition-colors`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-[#fafafa]">{notice.title}</h3>
                            {notice.isPublished ? (
                              <span className="px-2 py-0.5 text-xs bg-green-900/30 text-green-400 rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" /> Published
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs bg-yellow-900/30 text-yellow-400 rounded-full flex items-center gap-1">
                                <EyeOff className="w-3 h-3" /> Draft
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[#737373] mt-1 line-clamp-1">{notice.content}</p>
                          <span className="text-xs text-[#525252] mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(notice.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openNoticeEdit(notice)}
                            className="text-[#737373] hover:text-[#d4af37] hover:bg-[#d4af37]/10"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteNotice(notice.id)}
                            className="text-[#737373] hover:text-red-500 hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Lecture Dialog */}
        <SimpleModal 
          open={lectureDialogOpen} 
          onClose={() => setLectureDialogOpen(false)}
          title={editingLecture ? 'Edit Lecture' : 'Create Lecture'}
        >
          <form onSubmit={handleLectureSubmit} className="space-y-4">
              <div>
                <Label className="text-[#a3a3a3]">Title *</Label>
                <Input
                  value={lectureForm.title}
                  onChange={(e) => setLectureForm({ ...lectureForm, title: e.target.value })}
                  className={`${theme.input} text-[#fafafa] mt-1`}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[#a3a3a3]">Instructor</Label>
                  <Input
                    value={lectureForm.instructor}
                    onChange={(e) => setLectureForm({ ...lectureForm, instructor: e.target.value })}
                    className={`${theme.input} text-[#fafafa] mt-1`}
                  />
                </div>
                <div>
                  <Label className="text-[#a3a3a3]">Duration</Label>
                  <Input
                    value={lectureForm.duration}
                    onChange={(e) => setLectureForm({ ...lectureForm, duration: e.target.value })}
                    placeholder="e.g., 1h 30m"
                    className={`${theme.input} text-[#fafafa] mt-1`}
                  />
                </div>
              </div>
              <div>
                <Label className="text-[#a3a3a3]">Thumbnail URL</Label>
                <Input
                  value={lectureForm.thumbnail}
                  onChange={(e) => setLectureForm({ ...lectureForm, thumbnail: e.target.value })}
                  className={`${theme.input} text-[#fafafa] mt-1`}
                />
              </div>
              <div>
                <Label className="text-[#a3a3a3]">Video URL</Label>
                <Input
                  value={lectureForm.videoUrl}
                  onChange={(e) => setLectureForm({ ...lectureForm, videoUrl: e.target.value })}
                  className={`${theme.input} text-[#fafafa] mt-1`}
                />
              </div>
              <div>
                <Label className="text-[#a3a3a3]">Description</Label>
                <Textarea
                  value={lectureForm.description}
                  onChange={(e) => setLectureForm({ ...lectureForm, description: e.target.value })}
                  className={`${theme.input} text-[#fafafa] mt-1`}
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-[#a3a3a3]">Content</Label>
                <Textarea
                  value={lectureForm.content}
                  onChange={(e) => setLectureForm({ ...lectureForm, content: e.target.value })}
                  className={`${theme.input} text-[#fafafa] mt-1`}
                  rows={4}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={lectureForm.isPublished}
                  onCheckedChange={(checked) => setLectureForm({ ...lectureForm, isPublished: checked })}
                />
                <Label className="text-[#a3a3a3]">Publish immediately</Label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLectureDialogOpen(false)}
                  className="border-[#262626] text-[#737373] hover:text-[#fafafa] hover:bg-[#1f1f1f]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={`${theme.accentBg} text-black ${theme.accentHover}`}
                >
                  {editingLecture ? 'Update' : 'Create'}
                </Button>
              </div>
              </form>
        </SimpleModal>

        {/* Notice Dialog */}
        <SimpleModal 
          open={noticeDialogOpen} 
          onClose={() => setNoticeDialogOpen(false)}
          title={editingNotice ? 'Edit Notice' : 'Create Notice'}
        >
          <form onSubmit={handleNoticeSubmit} className="space-y-4">
              <div>
                <Label className="text-[#a3a3a3]">Title *</Label>
                <Input
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  className={`${theme.input} text-[#fafafa] mt-1`}
                  required
                />
              </div>
              <div>
                <Label className="text-[#a3a3a3]">Content *</Label>
                <Textarea
                  value={noticeForm.content}
                  onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
                  className={`${theme.input} text-[#fafafa] mt-1`}
                  rows={6}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={noticeForm.isPublished}
                  onCheckedChange={(checked) => setNoticeForm({ ...noticeForm, isPublished: checked })}
                />
                <Label className="text-[#a3a3a3]">Publish immediately</Label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNoticeDialogOpen(false)}
                  className="border-[#262626] text-[#737373] hover:text-[#fafafa] hover:bg-[#1f1f1f]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={`${theme.accentBg} text-black ${theme.accentHover}`}
                >
                  {editingNotice ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
        </SimpleModal>
      </div>
    </div>
  );
}
