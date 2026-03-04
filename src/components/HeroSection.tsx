export function HeroSection() {
  return (
    <section className="relative bg-black border-b-4 border-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="text-center">
          <h1 
            className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-4 tracking-tight"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            믿을 수 있는 명품 쇼핑
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto font-medium">
            검증된 상품만을 엄선하여 제공합니다
          </p>
        </div>
      </div>
    </section>
  );
}
