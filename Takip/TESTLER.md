# Test ve doğrulama kayıtları

Bu dosyada çalıştırılan kontroller ve sonuçları tutulur.

- Aşama 1: `npm run build` başarılı; TypeScript kontrolü ve üretim derlemesi tamamlandı.
- Aşama 1: `better-sqlite3` bellek içi veritabanında basit sorgu başarılı.
- `npm install` iki bağımlılık güvenlik uyarısı bildirdi (bir orta, bir yüksek); incelenmesi gerekiyor.
- Aşama 2: `npm run build` başarılı; TypeScript kontrolü ve API rotasının derlenmesi tamamlandı. Tarayıcı üzerinden işlevsel kontrol henüz yapılmadı.
- Aşama 2 genişletmesi: Üretim derlemesi başarılı; ayrı veritabanında API üzerinden ekleme, boş alan, sıralama, düzenleme, geçersiz veri ve silme kontrolleri başarılı. Tarayıcı otomasyon ortamı başlatılamadığı için görsel kontrol yapılamadı.

## Dinamik bina formu regresyonu

- Üretim derlemesi ve TypeScript kontrolü başarılı.
- İzole veritabanında eski zorunlu alanlı şema yeni şemaya taşındı; eski proje korundu.
- API üzerinden iki bina ve eşit/manüel kat dağılımıyla proje oluşturma, listeleme, bina sayısını değiştirerek güncelleme ve silme başarılı.
- Eşit bölünmeyen daire sayısı, daire girilmeden kat bilgisi ve toplamı tutmayan tamamlanmış manüel kat dağılımı sunucu tarafından reddedildi.
- Tarayıcı otomasyon ortamı başlatılamadı; kartların görünümü, alanların pasifleşmesi ve etkileşimleri tarayıcıda doğrulanamadı.

## Modal ve bodrum dağılımı

- Üretim derlemesi ve TypeScript kontrolü başarılı.
- İzole veritabanında bodrum dahil eşit dağılımla ekleme, bodrumsuz dağılımla güncelleme ve silme başarılı; eşit bölünmeyen değer reddedildi.
- Tarayıcı otomasyonu başlatılamadığından modal açılışı, kapanışı ve görsel etkileşimler doğrulanamadı.

## Metraj geliştirmesi

- Bina dağılımı doğrulaması ve metraj sütunu eklendikten sonra üretim derlemesi başarılı.
- Artan alanın proje genelindeki tüm dairelere eşit dağıtımı seçildi.
- İzole veritabanında eski şemanın geçişi, iki bina için metrajın hesaplanması ve kaydı, güncelleme, silme ve alan aşımı kontrolü başarılı.
- Tarayıcı otomasyonu başlatılamadığı için modal etkileşimleri ve önceki arayüz özellikleri görsel olarak doğrulanamadı.

## Giriş katının ayrılması

- Üretim derlemesi başarılı; izole API testlerinde bodrum, giriş ve normal katların manuel dağılımıyla kayıt, giriş hariç eşit dağılımla güncelleme, eşleşmeyen toplamın reddi ve silme başarılı.
- Giriş ve normal kat içeren metraj kaydı ve genel brüt toplamı doğrulandı. Tarayıcıdaki etkileşimler bu çalışmada doğrulanmadı.

## Proje notları

- Not alanı eklendikten sonra üretim derlemesi ve TypeScript kontrolü başarılı. Tarayıcıda kayıt ve düzenleme akışı ayrıca doğrulanmadı.

## Mahalle ve proje adı

- Mahalle alanı ve proje adı sıralaması değişikliğinden sonra üretim derlemesi ve TypeScript kontrolü başarılı. Tarayıcıda kayıt ve düzenleme akışı ayrıca doğrulanmadı.

## Sık kullanılan değerler

- Semt, mahalle, KAKS ve TAKS önerileri eklendikten sonra üretim derlemesi ve TypeScript kontrolü başarılı. Öneri listesinin tarayıcı etkileşimi ayrıca doğrulanmadı.

## Aşama 3: Maliyet motoru

- Üretim derlemesi ve TypeScript kontrolü başarılı.
- Hızlı modda otoparklı ve otoparksız hesap, alan aşımı kontrolü ve detaylı kalemlerin toplamı doğrulandı.
- İzole veritabanında proje oluşturma, iki maliyet modunu kaydetme, maliyetleri koruyarak proje güncelleme, listeleme ve silme başarılı; otopark alanının toplam alanı aşması reddedildi.
- Tarayıcı otomasyonu başlatılamadı; iki sekmenin etkileşimleri ve birinci ekran görsel olarak doğrulanamadı.

## Mimari analiz ve tekrar çalıştırılabilir regresyon

- `npm run build` başarılı; `npm test` izole geçici veritabanı ve yerel sunucu üzerinde başarılı.
- Eski şema geçişi, proje oluşturma/düzenleme/silme, bina dağılımı, metraj, iki maliyet modu ve senaryo kaydı ile hatalı girdilerin reddi kontrol edildi.
- Boş senaryolu bir projede maliyet ve proje işlemleri tamamlandı; senaryo kaydı sonrası proje güncellemesinde maliyet ve senaryo verileri korundu.
- Kısıt kombinasyonları, emsal/kot hesapları ve eşik taramaları birim seviyesinde kontrol edildi.
- Tarayıcı otomasyonu başlatılamadı; yeni ve mevcut ekranların görsel ve fareyle etkileşim regresyonu doğrulanamadı. Daha önce yalnızca tarayıcı kontrolü bekleyen senaryolar bu nedenle hâlâ açık.
- Yeniden çalıştırma: proje dizininde önce `npm run build`, sonra `npm test`.

## Mimari Simülatör ve kesit PDF’i

- Üretim derlemesi ve `npm test` başarılı. Otomatik regresyonda eski senaryo JSON’u, yeni ayar/metraj kaydı, geçersiz alanlar, sabit kat ve bölüm kimlikleri, çatı, çıkma, otopark, tarama ve proje/maliyet verisinin korunması sınandı.
- macOS Chrome’da aktif proje uyarısı, sekme sırası, ayarların paftaya yansıması, kritik kısıt uyarısı, bölüm/kat düzenleme, senaryo kaydetme ve sayfa yenileme kontrol edildi.
- Aynı tarayıcı akışında proje oluşturma, açma, düzenleme ve silme, Binaları Düzenle ve Daire m² pencereleri ile Hızlı Fizibilite ve Detaylı Keşif doğrulandı. Maliyet işlemleri henüz senaryo kaydedilmemiş projede de tamamlandı.
- Yazdır düğmesinin tarayıcı yazdırmasını çağırdığı kontrol edildi. Chrome ile PDF üretildi, Poppler ile yatay A4 ölçüsü ve görsel çıktı doğrulandı. Normal pafta tek sayfa, 18 normal katlı örnek iki sayfa çıktı. Başlık, kesit, taramalar, lejant ve metraj tablosu görünür. Menü, ayarlar, uyarılar ve düğmeler PDF dışında kaldı.
- Tarayıcı kontrolünü tekrarlamak için derlemeden sonra Playwright bulunan bir ortamda `node tests/browser-regression.cjs` çalıştır. `PLAYWRIGHT_MODULE` ve `CHROME_PATH` değişkenleriyle mevcut Playwright kurulumunu ve Chrome yürütülebilir dosyasını gösterebilirsin. Betik geçici bir veritabanı kullanır ve üretilen PDF’lerin konumunu yazar.
