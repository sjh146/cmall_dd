import { useState, useEffect } from 'react';
import { fetchLectures, type Lecture } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SimpleModal } from '../components/ui/SimpleModal';
import { 
  GraduationCap, Play, Clock, User, Calendar, 
  Video, ExternalLink 
} from 'lucide-react';

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
};

export default function LecturePage() {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);

  useEffect(() => {
    loadLectures();
  }, []);

  const loadLectures = async () => {
    try {
      setIsLoading(true);
      const data = await fetchLectures();
      setLectures(data);
    } catch (err) {
      console.error('Failed to load lectures:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className={`min-h-screen ${theme.bg}`}>
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a]"></div>
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#d4af37] rounded-full blur-[150px]"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#d4af37] rounded-full blur-[200px]"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-24">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-xl ${theme.gradient}`}>
              <GraduationCap className="w-8 h-8 text-black" />
            </div>
            <span className={`text-sm font-medium ${theme.accent} tracking-wider uppercase`}>
              Premium Education
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-[#fafafa] mb-4">
            Trading <span className={theme.accent}>Lectures</span>
          </h1>
          <p className={`text-lg ${theme.textMuted} max-w-2xl`}>
            Master the markets with expert-led courses. Learn proven strategies from experienced traders.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full mx-auto"></div>
            <p className={`mt-4 ${theme.textMuted}`}>Loading lectures...</p>
          </div>
        ) : lectures.length === 0 ? (
          <Card className={`${theme.card} border ${theme.cardBorder}`}>
            <CardContent className="py-20 text-center">
              <GraduationCap className="w-16 h-16 mx-auto mb-4 text-[#262626]" />
              <h3 className="text-xl font-semibold text-[#fafafa] mb-2">No Lectures Available</h3>
              <p className={theme.textMuted}>Check back soon for new content</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lectures.map((lecture, index) => (
              <Card 
                key={lecture.id} 
                className={`${theme.card} border ${theme.cardBorder} group hover:border-[#d4af37]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#d4af37]/5 cursor-pointer`}
                onClick={() => setSelectedLecture(lecture)}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden rounded-t-lg bg-[#1f1f1f]">
                  {lecture.thumbnail ? (
                    <img 
                      src={lecture.thumbnail} 
                      alt={lecture.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-12 h-12 text-[#262626]" />
                    </div>
                  )}
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className={`p-4 rounded-full ${theme.gradient}`}>
                      <Play className="w-8 h-8 text-black fill-black" />
                    </div>
                  </div>
                  {/* Duration badge */}
                  {lecture.duration && (
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs text-white flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {lecture.duration}
                    </div>
                  )}
                </div>

                <CardContent className="p-4">
                  <h3 className="font-semibold text-[#fafafa] mb-2 line-clamp-2 group-hover:text-[#d4af37] transition-colors">
                    {lecture.title}
                  </h3>
                  
                  {lecture.description && (
                    <p className={`text-sm ${theme.textSecondary} mb-3 line-clamp-2`}>
                      {lecture.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-sm">
                    {lecture.instructor && (
                      <span className={`flex items-center gap-1 ${theme.textMuted}`}>
                        <User className="w-3 h-3" />
                        {lecture.instructor}
                      </span>
                    )}
                    <span className={`flex items-center gap-1 ${theme.textMuted}`}>
                      <Calendar className="w-3 h-3" />
                      {formatDate(lecture.createdAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Lecture Detail Modal */}
      <SimpleModal
        open={!!selectedLecture}
        onClose={() => setSelectedLecture(null)}
        title=""
        className="max-w-3xl"
      >
        {selectedLecture && (
          <>
            {/* Video/Thumbnail */}
            <div className="relative aspect-video bg-[#1f1f1f] rounded-lg overflow-hidden -mt-2">
              {selectedLecture.videoUrl ? (
                <iframe
                  src={selectedLecture.videoUrl}
                  className="w-full h-full"
                  allowFullScreen
                />
              ) : selectedLecture.thumbnail ? (
                <img 
                  src={selectedLecture.thumbnail} 
                  alt={selectedLecture.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Video className="w-16 h-16 text-[#262626]" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-4">
              <h2 className="text-2xl font-bold text-[#fafafa] mb-3">
                {selectedLecture.title}
              </h2>
              
              <div className="flex flex-wrap gap-4 mb-4">
                {selectedLecture.instructor && (
                  <span className={`flex items-center gap-1 ${theme.textMuted}`}>
                    <User className="w-4 h-4" />
                    {selectedLecture.instructor}
                  </span>
                )}
                {selectedLecture.duration && (
                  <span className={`flex items-center gap-1 ${theme.textMuted}`}>
                    <Clock className="w-4 h-4" />
                    {selectedLecture.duration}
                  </span>
                )}
                <span className={`flex items-center gap-1 ${theme.textMuted}`}>
                  <Calendar className="w-4 h-4" />
                  {formatDate(selectedLecture.createdAt)}
                </span>
              </div>

              {selectedLecture.description && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-[#a3a3a3] mb-2">Description</h3>
                  <p className={`${theme.textSecondary}`}>{selectedLecture.description}</p>
                </div>
              )}

              {selectedLecture.content && (
                <div>
                  <h3 className="text-sm font-medium text-[#a3a3a3] mb-2">Content</h3>
                  <div className={`${theme.textSecondary} whitespace-pre-wrap`}>
                    {selectedLecture.content}
                  </div>
                </div>
              )}

              {selectedLecture.videoUrl && (
                <div className="mt-4">
                  <a 
                    href={selectedLecture.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 ${theme.accent} hover:underline`}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in new tab
                  </a>
                </div>
              )}
            </div>
          </>
        )}
      </SimpleModal>
    </div>
  );
}
