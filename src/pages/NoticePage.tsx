import { useState, useEffect } from 'react';
import { fetchNotices, type Notice } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { SimpleModal } from '../components/ui/SimpleModal';
import { 
  Bell, Calendar, ChevronRight, Pin 
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

export default function NoticePage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  useEffect(() => {
    loadNotices();
  }, []);

  const loadNotices = async () => {
    try {
      setIsLoading(true);
      const data = await fetchNotices();
      setNotices(data);
    } catch (err) {
      console.error('Failed to load notices:', err);
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

  const formatShortDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className={`min-h-screen ${theme.bg}`}>
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a]"></div>
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 right-10 w-72 h-72 bg-[#d4af37] rounded-full blur-[150px]"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-24">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-xl ${theme.gradient}`}>
              <Bell className="w-8 h-8 text-black" />
            </div>
            <span className={`text-sm font-medium ${theme.accent} tracking-wider uppercase`}>
              Announcements
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-[#fafafa] mb-4">
            Market <span className={theme.accent}>Notices</span>
          </h1>
          <p className={`text-lg ${theme.textMuted} max-w-2xl`}>
            Stay updated with the latest announcements, system updates, and important information.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full mx-auto"></div>
            <p className={`mt-4 ${theme.textMuted}`}>Loading notices...</p>
          </div>
        ) : notices.length === 0 ? (
          <Card className={`${theme.card} border ${theme.cardBorder}`}>
            <CardContent className="py-20 text-center">
              <Bell className="w-16 h-16 mx-auto mb-4 text-[#262626]" />
              <h3 className="text-xl font-semibold text-[#fafafa] mb-2">No Notices</h3>
              <p className={theme.textMuted}>Check back later for updates</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notices.map((notice, index) => (
              <Card 
                key={notice.id}
                className={`${theme.card} border ${theme.cardBorder} group hover:border-[#d4af37]/50 transition-all duration-300 cursor-pointer`}
                onClick={() => setSelectedNotice(notice)}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    {/* Date Badge */}
                    <div className="hidden sm:flex flex-col items-center justify-center w-14 h-14 bg-[#1f1f1f] rounded-lg shrink-0">
                      <span className={`text-lg font-bold ${theme.accent}`}>
                        {formatShortDate(notice.createdAt).split(' ')[1]}
                      </span>
                      <span className="text-xs text-[#525252]">
                        {formatShortDate(notice.createdAt).split(' ')[0]}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Pin className={`w-3 h-3 ${theme.accent}`} />
                        <span className={`text-xs ${theme.accent} font-medium`}>
                          NOTICE
                        </span>
                      </div>
                      <h3 className="font-semibold text-[#fafafa] mb-2 group-hover:text-[#d4af37] transition-colors line-clamp-1">
                        {notice.title}
                      </h3>
                      <p className={`${theme.textSecondary} text-sm line-clamp-2`}>
                        {notice.content}
                      </p>
                      <div className={`flex items-center gap-1 mt-2 text-xs ${theme.textMuted}`}>
                        <Calendar className="w-3 h-3" />
                        {formatDate(notice.createdAt)}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className={`w-5 h-5 ${theme.textMuted} group-hover:text-[#d4af37] transition-colors shrink-0`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Notice Detail Modal */}
      <SimpleModal
        open={!!selectedNotice}
        onClose={() => setSelectedNotice(null)}
        title=""
      >
        {selectedNotice && (
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-3">
              <Pin className={`w-4 h-4 ${theme.accent}`} />
              <span className={`text-xs ${theme.accent} font-medium`}>
                NOTICE
              </span>
            </div>
            
            <h2 className="text-2xl font-bold text-[#fafafa] mb-4">
              {selectedNotice.title}
            </h2>
            
            <div className={`flex items-center gap-1 mb-6 pb-4 border-b border-[#262626] ${theme.textMuted}`}>
              <Calendar className="w-4 h-4" />
              <span className="text-sm">{formatDate(selectedNotice.createdAt)}</span>
            </div>

            <div className={`${theme.textSecondary} whitespace-pre-wrap leading-relaxed`}>
              {selectedNotice.content}
            </div>
          </div>
        )}
      </SimpleModal>
    </div>
  );
}
