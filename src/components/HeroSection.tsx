import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';

export function HeroSection() {
  return (
    <section className="relative bg-gradient-to-r from-purple-50 to-pink-50 py-12 sm:py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
              Pakaian Bekas Berkualitas di 307 Second
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 mb-6 sm:mb-8">
              Temukan penawaran menarik pada pakaian dan celana bekas yang masih bagus. Dari barang vintage hingga gaya modern.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8">
              <Button size="lg" className="px-6 sm:px-8 h-12">
                Belanja Pakaian
              </Button>
              <Button variant="outline" size="lg" className="px-6 sm:px-8 h-12">
                Lihat Celana
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto lg:mx-0">
              <div className="text-center">
                <p className="font-bold text-xl sm:text-2xl text-primary">500+</p>
                <p className="text-xs sm:text-sm text-gray-600">Barang Tersedia</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-xl sm:text-2xl text-primary">75K-750K</p>
                <p className="text-xs sm:text-sm text-gray-600">Kisaran Harga</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-xl sm:text-2xl text-primary">Harian</p>
                <p className="text-xs sm:text-sm text-gray-600">Barang Baru</p>
              </div>
            </div>
          </div>
          <div className="relative order-first lg:order-last">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&h=400&fit=crop"
              alt="Rak pakaian thrift berwarna-warni di 307 Second"
              className="rounded-lg shadow-xl w-full h-64 sm:h-80 lg:h-96 object-cover"
            />
            <div className="absolute -bottom-3 -left-3 sm:-bottom-4 sm:-left-4 bg-white p-3 sm:p-4 rounded-lg shadow-lg">
              <p className="font-medium text-gray-900 text-sm sm:text-base">307 Second</p>
              <p className="text-xs sm:text-sm text-gray-600">Toko Thrift Sejak 2015</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}