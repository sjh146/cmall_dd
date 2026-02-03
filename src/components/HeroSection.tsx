import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';

export function HeroSection() {
  return (
    <section className="relative bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-3">
            믿을 수 있는 중고 명품 쇼핑
            </h1>
          <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
            검증된 상품만을 엄선하여 제공합니다
          </p>
        </div>
      </div>
    </section>
  );
}