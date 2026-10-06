const http = require("http");

/*
  JadoMovie Publisher Bot
  Node.js 18+

  مراحل انتشار:
  1. پوستر
  2. سال ساخت
  3. نام انگلیسی
  4. امتیاز IMDb
  5. کشور سازنده
  6. ژانر
  7. خلاصه داستان
  8. نوع دانلود
  9. لینک زیرنویس / دوبله
  10. انتشار در کانال

  Premium Emoji فعال است.
*/

const BOT_TOKEN = "8802340831:AAHdNczEj3G8wJhH0KtCsPMvqXPH6iNIRoY";
const OWNER_ID = "8639455918";
const DEFAULT_CHANNEL = "@JadoMovie";
const PORT = 10000;
/* =========================
   Premium Emoji IDs
========================= */

const EMOJI = {
  film: "5937999673510858217",
  movie: "5911002797578396680",
  country: "5987875234638730248",
  genre: "6032625495328165724",
  summary: "5886436057091673541",
  subtitle: "5870753782874246579",
  dub: "5258336354642697821",
  channel: "5877468380125990242",
  download: "5897554554894946515",
  imdb: "6028346797368283073"
};

/*
  ساخت Premium Emoji
*/
function premiumEmoji(id, fallback = "⭐") {
  return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}

/* =========================
   Runtime Storage
========================= */

const admins = new Set();
const states = new Map();

const channels = new Map([
  [
    String(DEFAULT_CHANNEL),
    {
      id: DEFAULT_CHANNEL,
      username: DEFAULT_CHANNEL,
      title: "JadoMovie"
    }
  ]
]);

/* =========================
   Telegram API
========================= */

async function tg(method, body = {}) {
  if (!BOT_TOKEN) {
    throw new Error(
      "BOT_TOKEN تنظیم نشده است. آن را در Environment Variables قرار بده."
    );
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();

    if (!data.ok) {
      console.error(
        `Telegram API Error [${method}]:`,
        data.description
      );
    }

    return data;
  } catch (error) {
    console.error("Telegram Request Error:", error);

    return {
      ok: false,
      description: error.message
    };
  }
}

/* =========================
   Helpers
========================= */

function isAdmin(id) {
  return (
    String(id) === OWNER_ID ||
    admins.has(String(id))
  );
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function validURL(url) {
  return /^https?:\/\/\S+$/i.test(
    String(url || "").trim()
  );
}

async function send(chatId, text, extra = {}) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...extra
  });
}

/* =========================
   Main Menu
========================= */

async function startMenu(chatId, uid) {
  states.set(String(uid), {
    step: "choose_channel",
    chatId
  });

  const buttons = [...channels.values()].map(channel => [
    {
      text:
        channel.title ||
        channel.username ||
        "Channel",

      callback_data:
        "channel:" +
        String(channel.id)
    }
  ]);

  return send(
    chatId,
    "کانالی که می‌خواهی پست در آن منتشر شود را انتخاب کن:",
    {
      reply_markup: {
        inline_keyboard: buttons
      }
    }
  );
}

/* =========================
   Update Handler
========================= */

async function handle(update) {

  /* =========================
     CALLBACK
  ========================= */

  if (update.callback_query) {

    const query =
      update.callback_query;

    await tg(
      "answerCallbackQuery",
      {
        callback_query_id: query.id
      }
    );

    const uid =
      query.from.id;

    const chatId =
      query.message.chat.id;

    if (!isAdmin(uid)) {
      return;
    }

    if (
      query.data &&
      query.data.startsWith("channel:")
    ) {

      const channelId =
        query.data.slice(
          "channel:".length
        );

      const channel =
        [...channels.values()].find(
          c =>
            String(c.id) ===
            String(channelId)
        );

      if (!channel) {
        return send(
          chatId,
          "کانال پیدا نشد."
        );
      }

      states.set(
        String(uid),
        {
          step: "poster",
          chatId,
          channel
        }
      );

      return send(
        chatId,
        "مرحله ۱/۸\n\nپوستر فیلم را به صورت عکس ارسال کن."
      );
    }

    return;
  }

  /* =========================
     MESSAGE
  ========================= */

  const msg =
    update.message;

  if (!msg) {
    return;
  }

  const uid =
    msg.from?.id;

  const chatId =
    msg.chat.id;

  if (!uid) {
    return;
  }

  /* =========================
     START
  ========================= */

  if (
    msg.text &&
    msg.text.startsWith("/start")
  ) {

    if (isAdmin(uid)) {
      return startMenu(
        chatId,
        uid
      );
    }

    return send(
      chatId,
      "سلام 👋\n\nاین ربات مدیریت و انتشار پست‌های JadoMovie است."
    );
  }

  /* =========================
     CANCEL
  ========================= */

  if (
    msg.text === "/cancel"
  ) {

    states.delete(
      String(uid)
    );

    return send(
      chatId,
      "عملیات لغو شد."
    );
  }

  /* =========================
     MENU
  ========================= */

  if (
    msg.text === "/menu" &&
    isAdmin(uid)
  ) {

    return startMenu(
      chatId,
      uid
    );
  }

  /* =========================
     ADD ADMIN
  ========================= */

  if (
    msg.text === "/addadmin" &&
    String(uid) === OWNER_ID
  ) {

    states.set(
      String(uid),
      {
        step: "addadmin",
        chatId
      }
    );

    return send(
      chatId,
      "آیدی عددی ادمین جدید را بفرست."
    );
  }

  /* =========================
     DELETE ADMIN
  ========================= */

  if (
    msg.text === "/deladmin" &&
    String(uid) === OWNER_ID
  ) {

    states.set(
      String(uid),
      {
        step: "deladmin",
        chatId
      }
    );

    return send(
      chatId,
      "آیدی عددی ادمینی که باید حذف شود را بفرست."
    );
  }

  /* =========================
     LIST ADMINS
  ========================= */

  if (
    msg.text === "/admins" &&
    String(uid) === OWNER_ID
  ) {

    return send(
      chatId,
      `مالک: ${escapeHTML(OWNER_ID)}

ادمین‌ها:

${
  [...admins].map(escapeHTML).join("\n") ||
  "موردی ثبت نشده."
}`
    );
  }

  /* =========================
     ADD CHANNEL
  ========================= */

  if (
    msg.text === "/addchannel" &&
    isAdmin(uid)
  ) {

    states.set(
      String(uid),
      {
        step: "addchannel",
        chatId
      }
    );

    return send(
      chatId,
      "یوزرنیم کانال را بفرست.\n\nمثال:\n@JadoMovie\n\nربات باید در کانال ادمین باشد."
    );
  }

  /* =========================
     LIST CHANNELS
  ========================= */

  if (
    msg.text === "/channels" &&
    isAdmin(uid)
  ) {

    const list =
      [...channels.values()]
        .map(
          channel =>
            `${escapeHTML(
              channel.title
            )} — ${escapeHTML(
              channel.username
            )}`
        )
        .join("\n");

    return send(
      chatId,
      list || "کانالی ثبت نشده."
    );
  }

  /* =========================
     ADMIN CHECK
  ========================= */

  if (!isAdmin(uid)) {
    return;
  }

  const state =
    states.get(String(uid));

  if (!state) {
    return;
  }

  /* =========================
     POSTER
  ========================= */

  if (
    state.step === "poster" &&
    msg.photo &&
    msg.photo.length
  ) {

    state.poster =
      msg.photo[
        msg.photo.length - 1
      ].file_id;

    state.step = "year";

    states.set(
      String(uid),
      state
    );

    return send(
      chatId,
      "مرحله ۲/۸\n\nسال ساخت فیلم را بفرست.\n\nمثال: 2026"
    );
  }

  if (
    state.step === "poster"
  ) {

    return send(
      chatId,
      "لطفاً پوستر را به صورت عکس ارسال کن."
    );
  }

  /* =========================
     YEAR
  ========================= */

  if (
    state.step === "year" &&
    msg.text
  ) {

    const year =
      msg.text.trim();

    if (!/^\d{4}$/.test(year)) {

      return send(
        chatId,
        "سال ساخت باید چهار رقمی باشد.\n\nمثال: 2026"
      );
    }

    state.year = year;
    state.step = "en";

    states.set(
      String(uid),
      state
    );

    return send(
      chatId,
      "مرحله ۳/۸\n\nاسم انگلیسی فیلم را بفرست."
    );
  }

  /* =========================
     ENGLISH NAME
  ========================= */

  if (
    state.step === "en" &&
    msg.text
  ) {

    const name =
      msg.text.trim();

    if (!name) {

      return send(
        chatId,
        "اسم انگلیسی فیلم نمی‌تواند خالی باشد."
      );
    }

    state.en = name;
    state.step = "imdb";

    states.set(
      String(uid),
      state
    );

    return send(
      chatId,
      "مرحله ۴/۸\n\nامتیاز IMDb را بفرست.\n\nمثال: 6.6"
    );
  }

  /* =========================
     IMDb
  ========================= */

  if (
    state.step === "imdb" &&
    msg.text
  ) {

    const imdb =
      msg.text
        .trim()
        .replace(",", ".");

    const imdbNumber =
      Number(imdb);

    if (
      !Number.isFinite(imdbNumber) ||
      imdbNumber < 0 ||
      imdbNumber > 10
    ) {

      return send(
        chatId,
        "امتیاز IMDb معتبر نیست.\n\nمثال: 6.6"
      );
    }

    state.imdb =
      imdb;

    state.step =
      "country";

    states.set(
      String(uid),
      state
    );

    return send(
      chatId,
      "مرحله ۵/۸\n\nکشور سازنده را بفرست."
    );
  }

  /* =========================
     COUNTRY
  ========================= */

  if (
    state.step === "country" &&
    msg.text
  ) {

    const country =
      msg.text.trim();

    if (!country) {

      return send(
        chatId,
        "کشور سازنده نمی‌تواند خالی باشد."
      );
    }

    state.country =
      country;

    state.step =
      "genre";

    states.set(
      String(uid),
      state
    );

    return send(
      chatId,
      "مرحله ۶/۸\n\nژانر را بفرست.\n\nمثال:\nاکشن، هیجان‌انگیز، کمدی"
    );
  }

  /* =========================
     GENRE
  ========================= */

  if (
    state.step === "genre" &&
    msg.text
  ) {

    const genre =
      msg.text.trim();

    if (!genre) {

      return send(
        chatId,
        "ژانر نمی‌تواند خالی باشد."
      );
    }

    state.genre =
      genre;

    state.step =
      "summary";

    states.set(
      String(uid),
      state
    );

    return send(
      chatId,
      "مرحله ۷/۸\n\nخلاصه داستان را بفرست."
    );
  }

  /* =========================
     SUMMARY
  ========================= */

  if (
    state.step === "summary" &&
    msg.text
  ) {

    const summary =
      msg.text.trim();

    if (!summary) {

      return send(
        chatId,
        "خلاصه داستان نمی‌تواند خالی باشد."
      );
    }

    state.summary =
      summary;

    state.step =
      "type";

    states.set(
      String(uid),
      state
    );

    return send(
      chatId,
      "مرحله ۸/۸\n\nنوع دانلود را انتخاب کن:",
      {
        reply_markup: {
          keyboard: [
            [
              {
                text: "فقط زیرنویس"
              }
            ],
            [
              {
                text: "فقط دوبله"
              }
            ],
            [
              {
                text: "هر دو"
              }
            ],
            [
              {
                text: "/cancel"
              }
            ]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    );
  }

  /* =========================
     DOWNLOAD TYPE
  ========================= */

  if (
    state.step === "type" &&
    msg.text
  ) {

    const type =
      msg.text.trim();

    const allowed = [
      "فقط زیرنویس",
      "فقط دوبله",
      "هر دو"
    ];

    if (
      !allowed.includes(type)
    ) {

      return send(
        chatId,
        "یکی از گزینه‌های زیر را انتخاب کن:\n\nفقط زیرنویس\nفقط دوبله\nهر دو"
      );
    }

    state.type =
      type;

    /*
      حذف کیبورد
    */

    const removeKeyboard = {
      reply_markup: {
        remove_keyboard: true
      }
    };

    /* فقط زیرنویس */

    if (
      type === "فقط زیرنویس"
    ) {

      state.step =
        "sub";

      states.set(
        String(uid),
        state
      );

      return send(
        chatId,
        "لینک دانلود زیرنویس فارسی را ارسال کن.",
        removeKeyboard
      );
    }

    /* فقط دوبله */

    if (
      type === "فقط دوبله"
    ) {

      state.step =
        "dub";

      states.set(
        String(uid),
        state
      );

      return send(
        chatId,
        "لینک دانلود دوبله فارسی را ارسال کن.",
        removeKeyboard
      );
    }

    /* هر دو */

    state.step =
      "sub";

    states.set(
      String(uid),
      state
    );

    return send(
      chatId,
      "اول لینک دانلود زیرنویس فارسی را ارسال کن.",
      removeKeyboard
    );
  }

  /* =========================
     SUBTITLE LINK
  ========================= */

  if (
    state.step === "sub" &&
    msg.text
  ) {

    const url =
      msg.text.trim();

    if (!validURL(url)) {

      return send(
        chatId,
        "❌ لینک معتبر نیست.\n\nلطفاً لینک را با http:// یا https:// ارسال کن."
      );
    }

    state.sub =
      url;

    /*
      اگر هر دو انتخاب شده باشد،
      حالا لینک دوبله گرفته می‌شود.
    */

    if (
      state.type === "هر دو"
    ) {

      state.step =
        "dub";

      states.set(
        String(uid),
        state
      );

      return send(
        chatId,
        "حالا لینک دانلود دوبله فارسی را ارسال کن."
      );
    }

    return publish(
      uid,
      state
    );
  }

  /* =========================
     DUB LINK
  ========================= */

  if (
    state.step === "dub" &&
    msg.text
  ) {

    const url =
      msg.text.trim();

    if (!validURL(url)) {

      return send(
        chatId,
        "❌ لینک معتبر نیست.\n\nلطفاً لینک را با http:// یا https:// ارسال کن."
      );
    }

    state.dub =
      url;

    return publish(
      uid,
      state
    );
  }

  /* =========================
     ADD ADMIN
  ========================= */

  if (
    state.step === "addadmin" &&
    msg.text &&
    String(uid) === OWNER_ID
  ) {

    const id =
      msg.text.trim();

    if (!/^\d+$/.test(id)) {

      return send(
        chatId,
        "آیدی عددی معتبر بفرست."
      );
    }

    admins.add(id);

    states.delete(
      String(uid)
    );

    return send(
      chatId,
      "ادمین با موفقیت اضافه شد ✅"
    );
  }

  /* =========================
     DELETE ADMIN
  ========================= */

  if (
    state.step === "deladmin" &&
    msg.text &&
    String(uid) === OWNER_ID
  ) {

    const id =
      msg.text.trim();

    admins.delete(id);

    states.delete(
      String(uid)
    );

    return send(
      chatId,
      "ادمین با موفقیت حذف شد ✅"
    );
  }

  /* =========================
     ADD CHANNEL
  ========================= */

  if (
    state.step === "addchannel" &&
    msg.text
  ) {

    const username =
      msg.text.trim();

    const result =
      await tg(
        "getChat",
        {
          chat_id: username
        }
      );

    if (!result.ok) {

      return send(
        chatId,
        "کانال پیدا نشد یا ربات دسترسی ندارد.\n\nمطمئن شو ربات در کانال ادمین است."
      );
    }

    const channel = {
      id: result.result.id,

      username:
        result.result.username
          ? "@" +
            result.result.username
          : username,

      title:
        result.result.title ||
        username
    };

    channels.set(
      String(channel.id),
      channel
    );

    states.delete(
      String(uid)
    );

    return send(
      chatId,
      `کانال «${escapeHTML(
        channel.title
      )}» با موفقیت اضافه شد ✅`
    );
  }
}

/* =========================
   Build Post
========================= */

function buildPost(state) {

  const channelName =
    String(
      state.channel?.username ||
      DEFAULT_CHANNEL
    ).replace(/^@/, "");

  const filmEmoji =
    premiumEmoji(
      EMOJI.film,
      "🎬"
    );

  const movieEmoji =
    premiumEmoji(
      EMOJI.movie,
      "🎞️"
    );

  const countryEmoji =
    premiumEmoji(
      EMOJI.country,
      "🌍"
    );

  const genreEmoji =
    premiumEmoji(
      EMOJI.genre,
      "🎭"
    );

  const summaryEmoji =
    premiumEmoji(
      EMOJI.summary,
      "💬"
    );

  const subtitleEmoji =
    premiumEmoji(
      EMOJI.subtitle,
      "🔤"
    );

  const dubEmoji =
    premiumEmoji(
      EMOJI.dub,
      "🎙️"
    );

  const downloadEmoji =
    premiumEmoji(
      EMOJI.download,
      "⬇️"
    );

  const imdbEmoji =
    premiumEmoji(
      EMOJI.imdb,
      "⭐"
    );

  const channelEmoji =
    premiumEmoji(
      EMOJI.channel,
      "📣"
    );

  /*
    بخش اول پست
  */

  const lines = [];

  lines.push(
    `<b>${filmEmoji} فیلم : ${escapeHTML(
      state.en
    )} ${escapeHTML(
      state.year
    )}</b>`
  );

  lines.push(
    `<b>${movieEmoji} | Movie : ${escapeHTML(
      state.en
    )} | ${imdbEmoji} ${escapeHTML(
      state.imdb
    )}</b>`
  );

  lines.push("");

  lines.push(
    `<b>${countryEmoji} محصول : ${escapeHTML(
      state.country
    )}</b>`
  );

  lines.push(
    `<b>${genreEmoji} ژانر : ${escapeHTML(
      state.genre
    )}</b>`
  );

  lines.push("");

  /*
    خلاصه داستان
  */

  const summaryPrefix =
    `<blockquote><b>${summaryEmoji} خلاصه داستان : `;

  const summarySuffix =
    `</b></blockquote>`;

  /*
    لینک‌ها
  */

  let downloadSection = "";

  if (state.sub) {

    downloadSection +=
      `${subtitleEmoji} <b>زیرنویس فارسی :</b>\n`;

    downloadSection +=
      `${downloadEmoji} <a href="${escapeAttribute(
        state.sub
      )}">برای دانلود اینجا کلیک کنید</a>\n`;
  }

  if (state.dub) {

    if (downloadSection) {
      downloadSection += "\n";
    }

    downloadSection +=
      `${dubEmoji} <b>دوبله فارسی :</b>\n`;

    downloadSection +=
      `${downloadEmoji} <a href="${escapeAttribute(
        state.dub
      )}">برای دانلود اینجا کلیک کنید</a>\n`;
  }

  /*
    کپشن Telegram حداکثر 1024 کاراکتر است.
    برای اطمینان، خلاصه را کوتاه می‌کنیم.
  */

  const footer =
    `${channelEmoji} @${escapeHTML(
      channelName
    )}`;

  const fixed =
    lines.join("\n").length +
    summaryPrefix.length +
    summarySuffix.length +
    downloadSection.length +
    footer.length +
    100;

  const maxSummary =
    Math.max(
      100,
      1024 - fixed
    );

  let summary =
    String(
      state.summary || ""
    ).trim();

  if (
    summary.length >
    maxSummary
  ) {

    summary =
      summary
        .slice(
          0,
          maxSummary - 3
        )
        .trimEnd() +
      "...";
  }

  lines.push(
    `${summaryPrefix}${escapeHTML(
      summary
    )}${summarySuffix}`
  );

  lines.push("");

  if (downloadSection) {
    lines.push(
      downloadSection.trimEnd()
    );

    lines.push("");
  }

  lines.push(
    footer
  );

  return lines.join("\n");
}

/* =========================
   Publish
========================= */

async function publish(
  uid,
  state
) {

  try {

    const caption =
      buildPost(state);

    const result =
      await tg(
        "sendPhoto",
        {
          chat_id:
            state.channel.id,

          photo:
            state.poster,

          caption,

          parse_mode:
            "HTML"
        }
      );

    states.delete(
      String(uid)
    );

    if (result.ok) {

      return send(
        state.chatId || uid,
        "پست با موفقیت در کانال منتشر شد ✅"
      );
    }

    console.error(
      "Publish Error:",
      result.description
    );

    return send(
      state.chatId || uid,
      `انتشار ناموفق بود ❌

${escapeHTML(
  result.description ||
  "خطای نامشخص"
)}`
    );

  } catch (error) {

    console.error(
      "Publish Exception:",
      error
    );

    return send(
      state.chatId || uid,
      `هنگام انتشار خطا رخ داد ❌

${escapeHTML(
  error.message
)}`
    );
  }
}

/* =========================
   Webhook
========================= */

async function setWebhook(
  baseUrl
) {

  return tg(
    "setWebhook",
    {
      url:
        `${baseUrl}/webhook`
    }
  );
}

/* =========================
   HTTP Server
========================= */

const server =
  http.createServer(
    async (
      req,
      res
    ) => {

      try {

        /* =========================
           HOME
        ========================= */

        if (
          req.method === "GET" &&
          req.url === "/"
        ) {

          res.writeHead(
            200,
            {
              "content-type":
                "text/plain; charset=utf-8"
            }
          );

          return res.end(
            "JadoMovie Bot is running."
          );
        }

        /* =========================
           SETUP WEBHOOK
        ========================= */

        if (
          req.method === "GET" &&
          req.url === "/setup"
        ) {

          const baseUrl =
            `https://${req.headers.host}`;

          const result =
            await setWebhook(
              baseUrl
            );

          res.writeHead(
            result.ok
              ? 200
              : 500,
            {
              "content-type":
                "application/json; charset=utf-8"
            }
          );

          return res.end(
            JSON.stringify(
              result
            )
          );
        }

        /* =========================
           WEBHOOK
        ========================= */

        if (
          req.method === "POST" &&
          req.url === "/webhook"
        ) {

          let body = "";

          req.on(
            "data",
            chunk => {
              body += chunk;
            }
          );

          req.on(
            "end",
            async () => {

              try {

                const update =
                  JSON.parse(body);

                await handle(
                  update
                );

              } catch (error) {

                console.error(
                  "Webhook Error:",
                  error
                );
              }

              res.writeHead(
                200
              );

              res.end(
                "ok"
              );
            }
          );

          return;
        }

        /* =========================
           NOT FOUND
        ========================= */

        res.writeHead(
          404
        );

        res.end(
          "Not found"
        );

      } catch (error) {

        console.error(
          "Server Error:",
          error
        );

        res.writeHead(
          500
        );

        res.end(
          "Server error"
        );
      }
    }
  );

/* =========================
   Start Server
========================= */

server.listen(
  PORT,
  () => {

    console.log(
      `JadoMovie Bot listening on ${PORT}`
    );

  }
);
