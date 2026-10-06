JadoMovie Bot — Render TEST BUILD

این نسخه برای Render آماده شده و نیاز به npm package ندارد.

مشخصات تست داخل server.js قرار گرفته:
- Owner ID: 8639455918
- Bot username: Managerjadomutbot
- Channel: @JadoMovie
- Bot token: داخل server.js

راه‌اندازی:
1) این پروژه را در GitHub قرار بده.
2) در Render → New Web Service → Public Git Repository، لینک GitHub را وارد کن.
3) Runtime را Node انتخاب کن.
4) Build Command را خالی بگذار.
5) Start Command: node server.js
6) Deploy کن.
7) بعد از Deploy آدرس Worker/Service را باز کن و انتهای آن /setup را بزن.
   مثال: https://YOUR-SERVICE.onrender.com/setup
8) ربات را در @JadoMovie ادمین کن.
9) در تلگرام به ربات /start بده.

فرمان‌های مدیریت:
 /menu
 /addchannel
 /channels
 /addadmin
 /deladmin
 /admins
 /emoji
 /cancel

نکته تست:
این نسخه برای شروع، state و لینک‌های دانلود را در RAM نگه می‌دارد؛ با Restart شدن سرویس این اطلاعات پاک می‌شوند. برای نسخه نهایی بهتر است دیتابیس/Redis اضافه شود.

امنیت:
توکن در این نسخه عمداً داخل server.js قرار گرفته چون نسخه تستی است. پس از اتمام تست حتماً توکن را در BotFather revoke و با توکن جدید جایگزین کن.
