# Kentsel Dönüşüm Fizibilite Uygulaması — Devir Özeti

**Tarih** 19 Kasım 2026  
**Kaynak taban çizgisi** `main`, `05fe6b337f6dd694de6ae0ff16781b9061a50863` — “2. sekme Mimari Analiz Senaryolar eklenmesi”  
**Depo** [mhmtysfdmrc25/kentsel-deneme](https://github.com/mhmtysfdmrc25/kentsel-deneme)

Bu dosyayı yeni sohbete ekle. Yeni bilgisayarda depoyu klonla veya mevcut kopyayı aç ve Codex çalışma dizini olarak deponun kökünü seç. Geliştirmede `PROJECT_PLAN.md` yol haritasını, `Takip/TESTLER.md` doğrulama geçmişini ve aşağıdaki iş kurallarını birlikte kullan.

## Amaç ve çalışma biçimi

İstanbul’daki kentsel dönüşüm müteahhitleri, mimarlar ve mühendisler için Türkçe, yerel çalışan bir fizibilite ve teklif uygulaması. Proje ve mevcut yapı verilerini toplar, yeni yapı için maliyet hesabı ve opsiyonel mimari ön analiz sağlar. Satış geliri, malik ve müteahhit payları, kâr/zarar ve Excel teklif çıktısı yol haritasında yer alıyor.

Uygulama tarayıcıdan açılır. Next.js ve SQLite aynı bilgisayarda çalışır. Kullanım sırasında bulut veritabanı veya dış hizmet gerekmez. İlk bağımlılık kurulumu için npm paketlerine erişim gerekir. Ana geliştirme macOS üzerinde yapıldı, Windows hedef platform. Node.js dosya yollarında `node:path` ve `path.join()` kullanma kuralını koru. GitHub’a gönderimi kullanıcı kendisi yapıyor.

## Teknolojiler

| Bileşen | Mevcut kurulum |
| --- | --- |
| Uygulama ve yerel API | Next.js 15.5.29, App Router, React 19.3.1 |
| Dil ve arayüz | TypeScript 5.9.3, Tailwind CSS 4.3.5 ve `@tailwindcss/postcss` |
| Veri | SQLite ve `better-sqlite3` 12.11.1. Next.js ayarında paket sunucuya harici bağımlılık olarak tanımlı |
| Ortak durum | React Context. `localStorage` yalnızca aktif proje kimliğini tutuyor. Projeler ve hesap kayıtları SQLite’tan geliyor |
| Test | Node.js doğrulamaları, geçici SQLite dosyası ve yerel Next.js sunucusunda API regresyonu |
| Sürümleme | Git, npm ve takip edilen `package-lock.json` |

Yukarıdaki sürümler bu bilgisayarda kurulu sürümlerdir. Devir kontrolünde **Node.js 26.13.1** ve **npm 11.20.0** kullanıldı. Regresyon betiği TypeScript dosyalarını doğrudan Node ile yüklediğinden, yeni bilgisayarda önce aynı Node sürümüyle başlamak en tekrarlanabilir yoldur. Kurulum ve çalışma Windows’ta henüz denenmedi.

## Yeni bilgisayarda kurulum

Git ve Node.js’i kur. Depoya GitHub erişimin varsa aşağıdaki komutlar PowerShell’de veya macOS terminalinde çalışır. Mevcut bir depo kopyasında ilk iki satır yerine o kopyanın köküne geç.

```bash
git clone https://github.com/mhmtysfdmrc25/kentsel-deneme.git
cd kentsel-deneme
git log -1 --oneline
cd "Güncel proje"
node --version
npm --version
npm ci
npm run dev -- -H 127.0.0.1
```

Tarayıcıdan [http://127.0.0.1:3000](http://127.0.0.1:3000) adresini aç. Terminal farklı port gösterirse o portu kullan. Sunucuyu `Ctrl+C` ile kapat. Derleme, regresyon ve üretim modunda çalıştırma için `Güncel proje` dizininden şunları kullan:

```bash
npm run build
npm test
npm run start -- -H 127.0.0.1
```

`npm test` bir önceki üretim derlemesini kullanır ve yerel bir test portu açar. Kullanıcı veritabanı yerine geçici bir kopyada çalışır. `better-sqlite3` yerel bir Node modülüdür. İşletim sistemi veya Node değiştiğinde `node_modules` klasörünü taşımak yerine hedef bilgisayarda `npm ci` çalıştır. Windows’ta kurulum betiği veya native modül hatası çıkarsa önce npm çıktısını ve Node sürümünü kontrol et.

### Mevcut proje kayıtlarını taşıma

GitHub kodu taşır. Proje kayıtları `Güncel proje/data/kentsel.sqlite` dosyasındadır ve `data/` Git tarafından yok sayılır. Veritabanı yeni bilgisayarda bulunmazsa uygulama boş bir veritabanı açar. Eski kayıtları da gerekiyorsa:

1. Kaynak bilgisayarda uygulamayı ve veritabanını açık tutan araçları kapat.
2. `Güncel proje/data/` klasörünün tamamını yerel bir yedeğe veya güvenli bir aktarım konumuna kopyala. SQLite WAL kullanır. Tutarlı bir kopya için açık bir veritabanından yalnızca `kentsel.sqlite` dosyasını alma.
3. Yeni bilgisayarda uygulamayı açmadan önce klasörü klon içindeki `Güncel proje/data/` konumuna yerleştir. Hedefte daha önce kayıt girilmişse önce hedef klasörü ayrıca yedekle.
4. Uygulamayı açıp bir projede bina, metraj, maliyet ve senaryo kayıtlarını kontrol et. Üst menüden aktif projeyi yeniden seç. Bu seçim tarayıcıya özeldir.

Uygulama verisi ve kişisel dosyalar için Git yerine ayrı aktarım kullan. Bu devir sırasında gerçek veritabanı içeriği incelenmedi veya kopyalanmadı.

## Dosya yapısı

```text
kentsel-deneme/
├── README.md
├── PROJECT_PLAN.md
├── DEVIR_OZETI.md
├── Takip/
│   ├── CHECKPOINTLER.md
│   ├── KARARLAR.md
│   └── TESTLER.md
└── Güncel proje/
    ├── app/
    │   ├── page.tsx, layout.tsx, globals.css
    │   └── api/projects/
    │       ├── route.ts
    │       └── [id]/
    │           ├── route.ts
    │           ├── cost/route.ts
    │           └── scenario/route.ts
    ├── components/
    │   ├── project-context.tsx
    │   ├── building-cards.tsx, measure-modal.tsx
    │   ├── frequent-input.tsx
    │   └── cost-panel.tsx, scenario-panel.tsx
    ├── lib/
    │   ├── db.ts, projects.ts
    │   └── buildings.ts, metraj.ts, costs.ts, scenario.ts
    ├── tests/regression.cjs
    ├── package.json, package-lock.json
    ├── next.config.ts, tsconfig.json, postcss.config.mjs
    └── data/                           [yerel, Git dışında]
```

- `app/page.tsx` uygulama kabuğunu, sekme geçişini ve Dosya Yönetimi formunu içerir.
- `components/project-context.tsx` proje listesini, aktif projeyi ve `activeCostTotal` değerini sunar. `refresh()` başarılı kayıttan sonra listeyi yeniler.
- `lib/db.ts` tabloyu çalışma sırasında açar ve eski şemalara eksik sütunları ekler. `projects` tablosunda kimlik ve yapı alanları, `binalar_detay`, `daire_metraj_detaylari`, `quick_cost_data`, `detailed_cost_data` ve `architectural_scenarios` bulunur. Detaylar SQLite TEXT alanlarında JSON olarak tutulur. `cost_mode` seçili modu tutar.
- `GET/POST /api/projects` listeler ve oluşturur. `PUT/DELETE /api/projects/:id` proje bilgilerini günceller veya projeyi siler. `PUT /api/projects/:id/cost` ve `PUT /api/projects/:id/scenario` ilgili kayıt alanlarını ayrı ayrı günceller.
- Plan ve takip dosyaları çalışma kurallarını ve test geçmişini taşır. Eski README ve plan satırları ilk iskeleti anlattığından güncel ekran sayısı için kaynak kodu esas al.

## Tamamlanan işler ve önemli kararlar

### Dosya Yönetimi

- Proje oluşturma, seçme, düzenleme ve onayla kalıcı silme çalışıyor. Geri alma akışı bulunmuyor. Proje kimlik alanları boş bırakılabilir. Notlar ve mahalle bilgisi projeye kaydolur.
- Başlık örneği `Avcılar / Ambarlı · 12 Ada 34 Parsel`. Türkçe sıralama semt, mahalle, ada, parsel ve eşitlikte kayıt kimliğine göre. Ada ve parselde doğal sayısal sıralama kullanılır.
- Semt, mahalle, KAKS ve TAKS için “Sık kullanılanlar” önerileri en az üç kayıtlı projede görülen değerlerden üretilir. Metinler Türkçe büyük/küçük harf farkından bağımsız gruplanır.
- **Binaları Düzenle** penceresinde bina bazında daire, dükkân ve kat bilgileri alınır. Giriş katı normal kat sayısından ayrıdır. Giriş ve bodrum daire dağılımından hariç tutulabilir. Manuel dağılımın toplamı beklenen daire sayısıyla eşleşmeli, eşit dağılım tam sayı vermelidir. Uyuşmazlıkta modalın Kaydet düğmesi pasif kalır. Eski kayıtlarda girişin dahil olduğu normal kat sayısı yeni anlamına çevrilir.
- Bina bilgileri hazır ve toplam alan pozitif olduğunda **Daire m² Düzenle** penceresi kullanılabilir. Daire net/brüt ve daire bulunan katlardaki ortak alan girilir. Kat brüt = daire brüt + kat ortak alanı ÷ o kattaki daire sayısı. Genel brüt = kat brüt + projede artan inşaat alanı ÷ projedeki toplam daire sayısı.
- **Kullanıcının kesin kararı** artan alanı tüm projedeki dairelere eşit bölmektir. Aynı kalanın her binaya yeniden dağıtılması toplam alanı büyütür. Sunucu metrajı yeniden hesaplar, netin brütü veya kat brütlerinin toplam inşaat alanını aşmasını reddeder.

### Maliyet Hesabı

- Aktif proje seçimi gerekir. Alan kaynağı önce kayıtlı metrajdaki genel brüt toplamı, sonra projedeki toplam inşaat alanıdır.
- **Hızlı Fizibilite** üst yapı, opsiyonel otopark, yıkım/hafriyat, kira/taşınma ve proje/harç giderlerini toplar. Otopark varsa üst yapı alanından düşülür ve kendi birim fiyatıyla hesaplanır. Otopark alanı toplam alanı aşamaz.
- **Detaylı Keşif** gider adı, miktar, birim ve birim fiyat içeren eklenebilir ve silinebilir satırlardan oluşur. Satır maliyeti miktar × fiyat, genel maliyet satırların toplamıdır.
- İki modun girdileri birlikte saklanır. Kâr/Zarar için `activeCostTotal`, seçili projenin **kaydedilen** mod ve girdilerinden hesaplanır. Maliyet taslağı kaydedilmeden başka sekmeye veya projeye geçilirse yerel form durumu kaybolabilir.

### Mimari Analiz & Senaryolar

- Opsiyonel sekme. Mevcut arsa ve yapı verilerini okur. Kullanıcı %30 varsayımı, kot farkı, çıkma türü, dar arsa ve YENÇOK seçeneklerini kaydedebilir. Boş senaryo proje ve maliyet akışını engellemez.
- Teorik emsal alanı = arsa × KAKS. Varsayımsal brüt alan bonus açıksa emsal × 1,30. Kot farkı tahmini = arsa × TAKS × açığa çıkan kat adedi. Kot alanı brüt tahmine otomatik eklenmez. Çıkma seçimi kaydedilir ve alan formülünü değiştirmez.
- Uyarılar elimizdeki mevcut yapı verilerine dayalı **ön tarama** olarak tasarlandı. KAKS sonucu teorik emsal alanı olarak etiketlendi. %30 varsayımı veya kot farkı sonucu doğrudan imar hakkı olarak ele alınmaz. Çok binada kat eşiği için en yüksek mevcut bina kullanılır. Sığınak, asansör, yangın kaçışı ve kapıcı dairesi eşikleri kontrol başlığı oluşturur.
- Önceki çalışmada kullanılan resmî referanslar [Sığınak Yönetmeliği güncellemesi](https://duzce.csb.gov.tr/haberler/siginak-yonetmeligi-guncellendi-296606), [Planlı Alanlar İmar Yönetmeliği değişikliği](https://meslekihizmetler.csb.gov.tr/haberler/planli-alanlar-imar-yonetmeligi-nde-degisiklik-yapildi-305960) ve [yangın yönetmeliği kılavuzu](https://webdosya.csb.gov.tr/v2/meslekihizmetler/2026/05/Binalar-n-Yang-n-Korunmas-Hakk-nda-Y-netmelik-K-lavuzu-20260507112134.pdf). Parsel ve yapı özelinde karar verilecekse o tarihteki mevzuat ve belediye plan notları kontrol edilmeli.

## Test durumu, açık sorunlar ve sınırlar

- **19 Kasım 2026’da doğrulandı.** Commit `05fe6b3` geçici bir dizine çıkarıldı. Kurulu bağımlılıklarla yapılan temiz üretim derlemesi ve `npm test` geçti. Testler eski şema geçişini, proje CRUD işlemlerini, dağılım doğrulamasını, giriş katı metrajını, iki maliyet modunu, otopark sınırını, senaryo hesap ve uyarılarını, kayıtların birbirini ezmemesini kapsar.
- Önceki oturumlarda tarayıcı otomasyonu Node çalışma zamanını başlatamadı. Modal açma/kapatma, sık kullanılanların fareyle ve klavyeyle seçimi, proje değiştirme ve dar ekran davranışı için uçtan uca sonuç yok. Bu devirde tarayıcı testi yapılmadı.
- Yönetilen ortamda `npm test` ilk çalıştırmada yerel port için `listen EPERM` verdi. Aynı test gerekli izinle geçti. Bu hata test ortamında görüldü.
- Önceki kurulumda npm bir orta ve bir yüksek güvenlik uyarısı bildirmiş. Bu devirde güncel denetim yapılmadı. Kilit dosyası var, ancak bu devirde sıfırdan `npm ci` denenmedi.
- **Koddan görülen iş kuralı açığı** hızlı maliyet hesabı, yeni yapı alanı için mevcut yapının genel brüt/inşaat alanını vekil olarak kullanıyor. Mevcut ve önerilen yeni alan farklıysa sonuç doğrudan yeni projenin alanına göre hesaplanmaz. Mimari senaryo tahmini maliyet hesabına bağlı değil. Aşama 4 öncesinde kullanıcıyla yeni inşaat alanı veri kaynağını netleştir.
- **Koddan görülen doğrulama farkı** bina modali manuel dağılımdaki boş hücreleri reddediyor. Sunucu ise metraj kaydı olmayan bir projede, bazı kat hücreleri boşken tamamlanmamış dağılımı kaydedebiliyor. Taslak bina kaydı istenmiyorsa bu iki davranışı hizala ve test ekle.
- **Tamamlanmamış ekranlar** Kâr/Zarar ve Teklif Çıktısı menüde yer tutucu olarak görünüyor. Gelir/pay motoru, Excel üretimi ve Windows paketi henüz yok.

## Sıradaki adımlar

1. Yeni bilgisayarda kurulumu ve gerekiyorsa SQLite aktarımını tamamla. `npm run build` ve `npm test` ile başlangıç noktasını doğrula. Dosya Yönetimi → aktif proje → iki maliyet modu → mimari senaryoyu tarayıcıdan kontrol et.
2. Aşama 4’te satış gelirleri, malik/müteahhit payları, net kâr ve gerekiyorsa kâr marjını tanımla. `activeCostTotal` ile kaydedilen maliyeti bağla. Mevcut/yeni alan ayrımı, satışa konu birimler, malik payı, satış fiyatı ve vergi/diğer giderlerin kapsama girip girmeyeceğini kullanıcıyla netleştir.
3. Aşama 5’te Excel (.xlsx) teklif çıktısı ve Windows paketleme yöntemini belirle. Hedef Windows mimarisinde temiz kurulum, yerel SQLite modülü, yazılabilir veri dizini ve yedek geri yükleme akışını doğrula.
4. Her geliştirmede ilgili bir test senaryosu ekle, üretim derlemesini ve tüm otomatik regresyonu tekrar çalıştır. Sonucu `Takip/TESTLER.md` dosyasına yaz. Yeni kararları `Takip/KARARLAR.md`, ilerlemeyi `Takip/CHECKPOINTLER.md` içinde tut.

## Kesin bilinmeyenler

- `main` ve yerel `origin/main` aynı commit’i gösterdi. GitHub’daki canlı HEAD, deponun erişim durumu ve diğer bilgisayardaki GitHub hesabının yetkisi bağımsız kontrol edilmedi. Bu devir özeti commit veya push edilmedi.
- Hedef bilgisayarın işletim sistemi, işlemci mimarisi ve kurulu araçlar bilinmiyor. Kurulum komutları Git ve uygun Node.js bulunduğunu varsayar.
- Mevcut yerel veritabanında hangi gerçek projelerin bulunduğu, kullanıcı arayüzünün hangi cihazlarda kabul edildiği ve eski kayıtların hedef bilgisayara taşınıp taşınmayacağı doğrulanmadı.
- Yeni proje metrajı, kâr paylaşımı, teklif şablonu ve Windows dağıtım yöntemi için onaylı ayrıntılı kurallar henüz kayıtlarda yok. Metrajın proje geneline eşit dağıtım kararı bu belirsizliklerden bağımsızdır.
