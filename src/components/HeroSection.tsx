import { Link } from 'react-router-dom';
import { Button } from './ui/button';

export function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-primary/20 via-background to-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="text-center">
          <h1 
            className="text-4xl sm:text-5xl md:text-6xl font-black text-foreground mb-4 tracking-tight"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            Software & E-Books Marketplace
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto font-medium mb-8">
            Discover premium software tools and digital books from trusted sellers worldwide.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/">
              <Button size="lg" className="text-lg px-8">
                Browse Products
              </Button>
            </Link>
            <Link to="/seller">
              <Button variant="outline" size="lg" className="text-lg px-8">
                Start Selling
              </Button>
            </Link>
          </div>
          
          {/* Features */}
          <div className="grid grid-cols-3 gap-8 mt-16 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-3xl mb-2">💻</div>
              <div className="font-semibold">Premium Software</div>
              <div className="text-sm text-muted-foreground">Productivity & Dev Tools</div>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">📚</div>
              <div className="font-semibold">E-Books</div>
              <div className="text-sm text-muted-foreground">Learning & Reference</div>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🔒</div>
              <div className="font-semibold">Secure Payments</div>
              <div className="text-sm text-muted-foreground">100% Protected</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
