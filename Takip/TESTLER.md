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
