# Proje Planı

- **Aşama 1 (Şu an):** Next.js iskelet kurulumu, `better-sqlite3` bağlantısı ve 4 sekmeli ana menü (Dosya Yönetimi, Maliyet Hesabı, Kâr/Zarar, Teklif Çıktısı).
- **Aşama 2:** Ada/Parsel bazlı proje oluşturma ve veritabanına kaydetme (1. Ekran).
- **Aşama 3:** TAKS/KAKS formları, bina/daire m² girişleri ve canlı maliyet motoru (2. Ekran).
- **Ek çalışma:** Opsiyonel Mimari Simülatör. Yeni bina senaryoları, düzenlenebilir vektörel kesit, alan özeti, mevzuat ön taraması ve A4 yatay PDF çıktısı.
- **Aşama 4:** Satış gelirleri, müteahhit/malik payları ve net kâr analizi (3. Ekran).
- **Aşama 5:** Excel (.xlsx) dışa aktarım modülü ve projeyi Windows için paketleme.

## Çalışma düzeni

- `Güncel proje/`: Geliştirilen uygulamanın güncel kaynak kodu.
- `Takip/CHECKPOINTLER.md`: Tamamlanan aşamalar ve geri dönüş noktaları.
- `Takip/TESTLER.md`: Doğrulama sonuçları.
- `Takip/KARARLAR.md`: Bekleyen kararlar ve kabul edilmeyen öneriler.
- Her geliştirme için uygun yeni test senaryosu eklenir; üretim derlemesi ve tüm otomatik regresyon testleri yeniden çalıştırılır. Sonuçlar `Takip/TESTLER.md` dosyasına kaydedilir.
