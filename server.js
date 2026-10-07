const http = require("http");
const crypto = require("crypto");

/*
  JadoMovie Bot
  ارسال به گروه/سوپرگروه با Premium Custom Emoji
*/

const BOT_TOKEN =
  process.env.BOT_TOKEN || "8802340831:AAHdNczEj3G8wJhH0KtCsPMvqXPH6iNIRoY";

const OWNER_ID = "8639455918";
const BOT_USERNAME = "Managerjadomutbot";
const DEFAULT_CHANNEL = "@JadoMovie";

const admins = new Set();

const channels = new Map([
  [
    DEFAULT_CHANNEL,
    {
      id: DEFAULT_CHANNEL,
      username: DEFAULT_CHANNEL,
      title: "JadoMovie"
    }
  ]
]);

const states = new Map();
const downloads = new Map();
const emojiSamples = new Map();

const PORT = process.env.PORT || 10000;


/* =========================
   Telegram API
========================= */

async function tg(method, body = {}) {
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    return await r.json();
  } catch (e) {
    console.error("Telegram API error:", e);

    return {
      ok: false,
      description: e.message
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

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function validUrl(url) {
  return /^https?:\/\/\S+$/i.test(
    String(url || "").trim()
  );
}


/*
  Telegram entity offset/length
  بر اساس UTF-16 است.
*/

function utf16Length(s) {
  return [...String(s ?? "")].reduce(
    (n, ch) =>
      n +
      (ch.codePointAt(0) > 0xffff ? 2 : 1),
    0
  );
}


function utf16Slice(
  s,
  start,
  length
) {
  const arr = Array.from(
    String(s ?? "")
  );

  let pos = 0;
  let out = "";

  for (const ch of arr) {
    const size =
      ch.codePointAt(0) > 0xffff
        ? 2
        : 1;

    if (
      pos >= start &&
      pos < start + length
    ) {
      out += ch;
    }

    pos += size;

    if (
      pos >=
      start + length
    ) {
      break;
    }
  }

  return out;
}


function addEntity(
  entities,
  type,
  offset,
  length,
  extra = {}
) {
  if (length > 0) {
    entities.push({
      type,
      offset,
      length,
      ...extra
    });
  }
}


/* =========================
   Build JadoMovie Caption
========================= */

function buildJadoCaption(
  st,
  emojiList
) {
  const entities = [];
  let text = "";

  function append(value) {
    const start =
      utf16Length(text);

    text += value;

    return start;
  }

  function appendBold(value) {
    const start =
      append(value);

    addEntity(
      entities,
      "bold",
      start,
      utf16Length(value)
    );

    return start;
  }

  function appendCustom(
    fallback,
    customEmojiId
  ) {
    const start =
      append(fallback);

    addEntity(
      entities,
      "custom_emoji",
      start,
      utf16Length(fallback),
      {
        custom_emoji_id:
          String(customEmojiId)
      }
    );

    return start;
  }

  function emoji(
    index,
    fallback
  ) {
    const item =
      emojiList?.[index];

    if (item) {
      return appendCustom(
        item.fallback ||
          fallback,
        item.id
      );
    }

    return append(fallback);
  }


  /* =====================
     فیلم
  ===================== */

  emoji(0, "🎬");

  append(" ");

  appendBold(
    `فیلم : ${st.fa} | ${st.year}`
  );

  append("\n");


  /* =====================
     Movie
  ===================== */

  emoji(1, "🎞");

  append(" ");

  appendBold(
    `| Movie : ${st.en} | IMDb `
  );

  emoji(2, "⭐");

  append(` ${st.imdb}`);

  append("\n");


  /* =====================
     Country
  ===================== */

  emoji(3, "🌍");

  append(" ");

  appendBold(
    `کشور : ${st.country}`
  );

  append("\n");


  /* =====================
     Genre
  ===================== */

  emoji(4, "🎭");

  append(" ");

  appendBold(
    `ژانر : ${st.genre}`
  );

  append("\n\n");


  /* =====================
     Story
  ===================== */

  const storyStart =
    utf16Length(text);

  append("▌ ");

  emoji(5, "📖");

  append(" ");

  const story =
    String(st.summary || "");

  append(story);

  addEntity(
    entities,
    "blockquote",
    storyStart,
    utf16Length(
      text.slice(
        0,
        text.length
      )
    ) -
      storyStart
  );

  append("\n\n");


  /* =====================
     Subtitle
  ===================== */

  if (st.sub) {
    const label =
      "🔤 زیرنویس فارسی";

    const start =
      append(label);

    addEntity(
      entities,
      "text_link",
      start,
      utf16Length(label),
      {
        url: st.sub
      }
    );

    append("\n");
  }


  /* =====================
     Dubbed
  ===================== */

  if (st.dub) {
    const label =
      "🔊 دوبله فارسی";

    const start =
      append(label);

    addEntity(
      entities,
      "text_link",
      start,
      utf16Length(label),
      {
        url: st.dub
      }
    );

    append("\n");
  }


  append("\n");


  /* =====================
     Channel
  ===================== */

  appendBold(
    `📢 @${String(
      st.channel.username ||
      DEFAULT_CHANNEL
    ).replace(/^@/, "")}`
  );


  return {
    text,
    entities
  };
}


/* =========================
   Send Message
========================= */

async function send(
  chatId,
  text,
  extra = {}
) {
  return tg(
    "sendMessage",
    {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...extra
    }
  );
}


/* =========================
   Main Menu
========================= */

async function startMenu(
  chatId,
  uid
) {
  states.set(
    String(uid),
    {
      step: "choose_channel",
      chatId
    }
  );

  const buttons =
    [
      ...channels.values()
    ].map(c => [
      {
        text:
          c.title ||
          c.username,

        callback_data:
          "channel:" +
          String(c.id)
      }
    ]);

  return send(
    chatId,
    "مقصد انتشار پست را انتخاب کن:",
    {
      reply_markup: {
        inline_keyboard:
          buttons
      }
    }
  );
}


/* =========================
   Update Handler
========================= */

async function handle(update) {

  /* =====================
     Callback
  ===================== */

  if (update.callback_query) {
    const q =
      update.callback_query;

    await tg(
      "answerCallbackQuery",
      {
        callback_query_id: q.id
      }
    );

    const uid =
      q.from.id;

    const chatId =
      q.message.chat.id;

    if (!isAdmin(uid)) {
      return;
    }

    if (
      q.data?.startsWith(
        "channel:"
      )
    ) {
      const key =
        q.data.slice(8);

      const ch =
        [
          ...channels.values()
        ].find(
          c =>
            String(c.id) ===
            key
        );

      if (!ch) {
        return send(
          chatId,
          "مقصد پیدا نشد."
        );
      }

      states.set(
        String(uid),
        {
          step: "poster",
          chatId,
          channel: ch
        }
      );

      return send(
        chatId,
        "مرحله ۱/۱۰\nپوستر فیلم را به صورت عکس بفرست."
      );
    }

    return;
  }


  /* =====================
     Message
  ===================== */

  const msg =
    update.message;

  if (!msg) return;

  const uid =
    msg.from?.id;

  const chatId =
    msg.chat.id;

  if (!uid) return;


  /* =====================
     START
  ===================== */

  if (
    msg.text?.startsWith(
      "/start"
    )
  ) {
    const arg =
      msg.text.split(
        /\s+/
      )[1];

    if (
      arg &&
      arg.startsWith(
        "download_"
      )
    ) {
      return sendDownload(
        chatId,
        arg.slice(9)
      );
    }

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


  /* =====================
     CANCEL
  ===================== */

  if (
    msg.text ===
    "/cancel"
  ) {
    states.delete(
      String(uid)
    );

    return send(
      chatId,
      "عملیات لغو شد."
    );
  }


  /* =====================
     MENU
  ===================== */

  if (
    msg.text === "/menu" &&
    isAdmin(uid)
  ) {
    return startMenu(
      chatId,
      uid
    );
  }


  /* =====================
     ADD ADMIN
  ===================== */

  if (
    msg.text ===
      "/addadmin" &&
    String(uid) ===
      OWNER_ID
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


  /* =====================
     DELETE ADMIN
  ===================== */

  if (
    msg.text ===
      "/deladmin" &&
    String(uid) ===
      OWNER_ID
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


  /* =====================
     ADMINS
  ===================== */

  if (
    msg.text === "/admins" &&
    String(uid) ===
      OWNER_ID
  ) {
    return send(
      chatId,
      `مالک: ${OWNER_ID}\n\nادمین‌ها:\n${
        [...admins].join(
          "\n"
        ) ||
        "موردی ثبت نشده."
      }`
    );
  }


  /* =====================
     ADD CHANNEL
  ===================== */

  if (
    msg.text ===
      "/addchannel" &&
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
      "یوزرنیم کانال را بفرست؛ مثلاً @JadoMovie\nبرای گروه از /addgroup استفاده کن."
    );
  }


  /* =====================
     ADD GROUP
  ===================== */

  if (
    msg.text ===
      "/addgroup" &&
    isAdmin(uid)
  ) {
    states.set(
      String(uid),
      {
        step: "addgroup",
        chatId
      }
    );

    return send(
      chatId,
      "یوزرنیم گروه/سوپرگروه را بفرست؛ مثلاً @JadoMovieGroup\nربات باید در گروه اجازه ارسال پیام داشته باشد."
    );
  }


  /* =====================
     CHANNELS / GROUPS
  ===================== */

  if (
    msg.text ===
      "/channels" &&
    isAdmin(uid)
  ) {
    return send(
      chatId,
      [...channels.values()]
        .map(
          c =>
            `${c.title} — ${c.username}`
        )
        .join("\n")
    );
  }


  /* =====================
     PREMIUM EMOJI
  ===================== */

  if (
    msg.text === "/emoji" &&
    isAdmin(uid)
  ) {
    states.set(
      String(uid),
      {
        step:
          "emoji_sample",
        chatId
      }
    );

    return send(
      chatId,
      "حالا پست نمونه‌ای که ایموجی‌های پریمیوم دارد را مستقیم برای ربات بفرست یا فوروارد کن."
    );
  }


  /* =====================
     ADMIN CHECK
  ===================== */

  if (!isAdmin(uid)) {
    return;
  }


  const st =
    states.get(
      String(uid)
    );

  if (!st) return;


  /* =====================
     POSTER
  ===================== */

  if (
    st.step === "poster" &&
    msg.photo?.length
  ) {
    st.poster =
      msg.photo[
        msg.photo.length - 1
      ].file_id;

    st.step = "fa";

    states.set(
      String(uid),
      st
    );

    return send(
      chatId,
      "مرحله ۲/۱۰\nنام فارسی فیلم را بفرست."
    );
  }


  /* =====================
     TEXT STEPS
  ===================== */

  const textSteps = [

    [
      "fa",
      "سال انتشار را بفرست.",
      "year"
    ],

    [
      "year",
      "نام انگلیسی فیلم را بفرست.",
      "en"
    ],

    [
      "en",
      "امتیاز IMDb را بفرست؛ مثلاً 6.6",
      "imdb"
    ],

    [
      "imdb",
      "کشور سازنده را بفرست.",
      "country"
    ],

    [
      "country",
      "ژانر را بفرست.",
      "genre"
    ],

    [
      "genre",
      "خلاصه داستان را بفرست.",
      "summary"
    ]

  ];


  for (
    const [
      step,
      prompt,
      next
    ]
    of textSteps
  ) {

    if (
      st.step === step &&
      msg.text
    ) {

      st[step] =
        msg.text.trim();

      st.step =
        next;

      states.set(
        String(uid),
        st
      );

      return send(
        chatId,
        prompt
      );
    }
  }


  /* =====================
     SUMMARY
  ===================== */

  if (
    st.step ===
      "summary" &&
    msg.text
  ) {
    st.summary =
      msg.text.trim();

    st.step = "type";

    states.set(
      String(uid),
      st
    );

    return send(
      chatId,
      "نوع دانلود را انتخاب کن:",
      {
        reply_markup: {
          keyboard: [

            [
              {
                text:
                  "فقط زیرنویس"
              }
            ],

            [
              {
                text:
                  "فقط دوبله"
              }
            ],

            [
              {
                text:
                  "هر دو"
              }
            ],

            [
              {
                text:
                  "/cancel"
              }
            ]

          ],

          resize_keyboard:
            true
        }
      }
    );
  }


  /* =====================
     DOWNLOAD TYPE
  ===================== */

  if (
    st.step === "type" &&
    msg.text
  ) {

    const allowed = [
      "فقط زیرنویس",
      "فقط دوبله",
      "هر دو"
    ];

    if (
      !allowed.includes(
        msg.text
      )
    ) {
      return send(
        chatId,
        "یکی از گزینه‌ها را انتخاب کن."
      );
    }

    st.type =
      msg.text;


    if (
      msg.text ===
      "فقط زیرنویس"
    ) {
      st.step =
        "sub";

      states.set(
        String(uid),
        st
      );

      return send(
        chatId,
        "🔤 لینک دانلود زیرنویس فارسی را ارسال کن."
      );
    }


    if (
      msg.text ===
      "فقط دوبله"
    ) {
      st.step =
        "dub";

      states.set(
        String(uid),
        st
      );

      return send(
        chatId,
        "🔊 لینک دانلود دوبله فارسی را ارسال کن."
      );
    }


    st.step =
      "sub";

    states.set(
      String(uid),
      st
    );

    return send(
      chatId,
      "🔤 لینک دانلود زیرنویس فارسی را ارسال کن."
    );
  }


  /* =====================
     SUBTITLE
  ===================== */

  if (
    st.step === "sub" &&
    msg.text
  ) {

    const url =
      msg.text.trim();

    if (
      !validUrl(url)
    ) {
      return send(
        chatId,
        "❌ لینک معتبر نیست."
      );
    }

    st.sub =
      url;

    if (
      st.type === "هر دو"
    ) {
      st.step =
        "dub";

      states.set(
        String(uid),
        st
      );

      return send(
        chatId,
        "🔊 حالا لینک دانلود دوبله فارسی را ارسال کن."
      );
    }

    return publish(
      uid,
      st
    );
  }


  /* =====================
     DUB
  ===================== */

  if (
    st.step === "dub" &&
    msg.text
  ) {

    const url =
      msg.text.trim();

    if (
      !validUrl(url)
    ) {
      return send(
        chatId,
        "❌ لینک معتبر نیست."
      );
    }

    st.dub =
      url;

    return publish(
      uid,
      st
    );
  }


  /* =====================
     PREMIUM EMOJI SAMPLE
  ===================== */

  if (
    st.step ===
      "emoji_sample"
  ) {

    const sourceText =
      msg.text ??
      msg.caption ??
      "";

    const entities = [
      ...(msg.entities || []),
      ...(msg.caption_entities || [])
    ]
      .filter(
        e =>
          e.type ===
            "custom_emoji" &&
          e.custom_emoji_id
      )
      .sort(
        (a, b) =>
          a.offset -
          b.offset
      );


    const samples =
      entities.map(e => ({
        id:
          String(
            e.custom_emoji_id
          ),

        fallback:
          utf16Slice(
            sourceText,
            e.offset,
            e.length
          ) || "😀"
      }));


    const unique = [];
    const seen =
      new Set();


    for (
      const item of samples
    ) {
      if (
        !seen.has(
          item.id
        )
      ) {
        seen.add(
          item.id
        );

        unique.push(
          item
        );
      }
    }


    if (
      !unique.length
    ) {
      return send(
        chatId,
        "ایموجی پریمیوم قابل تشخیص پیدا نشد.\nپست نمونه را مستقیم برای ربات بفرست یا فوروارد کن."
      );
    }


    emojiSamples.set(
      String(uid),
      unique
    );


    states.delete(
      String(uid)
    );


    return send(
      chatId,
      `ایموجی‌های پریمیوم پیدا شد:\n\n${
        unique
          .map(
            (x, i) =>
              `${i + 1}. ${x.fallback} → ${x.id}`
          )
          .join("\n")
      }\n\nذخیره شد. برای ساخت پست /menu را بزن.`
    );
  }


  /* =====================
     ADD ADMIN
  ===================== */

  if (
    st.step ===
      "addadmin" &&
    msg.text &&
    String(uid) ===
      OWNER_ID
  ) {

    admins.add(
      msg.text.trim()
    );

    states.delete(
      String(uid)
    );

    return send(
      chatId,
      "ادمین اضافه شد ✅"
    );
  }


  /* =====================
     DELETE ADMIN
  ===================== */

  if (
    st.step ===
      "deladmin" &&
    msg.text &&
    String(uid) ===
      OWNER_ID
  ) {

    admins.delete(
      msg.text.trim()
    );

    states.delete(
      String(uid)
    );

    return send(
      chatId,
      "ادمین حذف شد ✅"
    );
  }


  /* =====================
     ADD CHANNEL / GROUP
  ===================== */

  if (
    (
      st.step ===
        "addchannel" ||
      st.step ===
        "addgroup"
    ) &&
    msg.text
  ) {

    const username =
      msg.text.trim();


    const r =
      await tg(
        "getChat",
        {
          chat_id:
            username
        }
      );


    if (!r.ok) {
      return send(
        chatId,
        "مقصد پیدا نشد یا ربات دسترسی ندارد."
      );
    }


    const c = {

      id:
        r.result.id,

      username:
        r.result.username
          ? "@" +
            r.result.username
          : username,

      title:
        r.result.title ||
        username

    };


    channels.set(
      String(c.id),
      c
    );


    states.delete(
      String(uid)
    );


    return send(
      chatId,

      st.step ===
        "addgroup"

        ? `گروه «${c.title}» اضافه شد ✅\nربات باید در گروه اجازه ارسال پیام داشته باشد.`

        : `کانال «${c.title}» اضافه شد ✅\nربات باید در کانال ادمین باشد.`
    );
  }
}


/* =========================
   Publish
========================= */

async function publish(
  uid,
  st
) {

  const emojiList =
    emojiSamples.get(
      String(uid)
    ) || [];


  const built =
    buildJadoCaption(
      st,
      emojiList
    );


  const r =
    await tg(
      "sendPhoto",
      {
        chat_id:
          st.channel.id,

        photo:
          st.poster,

        caption:
          built.text,

        caption_entities:
          built.entities
      }
    );


  states.delete(
    String(uid)
  );


  return send(
    st.chatId || uid,

    r.ok

      ? `پست با موفقیت در «${
          st.channel.title ||
          "گروه"
        }» منتشر شد ✅`

      : `انتشار ناموفق بود ❌\n\n${
          r.description ||
          "خطای نامشخص"
        }`
  );
}


/* =========================
   Download System
========================= */

function saveDownload(
  file_id,
  name,
  type
) {

  const key =
    crypto
      .randomBytes(10)
      .toString("hex");


  downloads.set(
    key,
    {
      file_id,
      name,
      type
    }
  );


  return key;
}


function sendDownload(
  chatId,
  key
) {

  const d =
    downloads.get(key);


  if (!d) {
    return send(
      chatId,
      "این لینک منقضی یا نامعتبر است."
    );
  }


  return tg(
    "sendDocument",
    {
      chat_id:
        chatId,

      document:
        d.file_id,

      caption:
        `${d.type}\n${d.name}`
    }
  );
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
        baseUrl +
        "/webhook"
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

        /* HOME */

        if (
          req.method ===
            "GET" &&
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


        /* SETUP */

        if (
          req.method ===
            "GET" &&
          req.url ===
            "/setup"
        ) {

          const base =
            `https://${req.headers.host}`;

          const r =
            await setWebhook(
              base
            );


          res.writeHead(
            r.ok ? 200 : 500,
            {
              "content-type":
                "application/json"
            }
          );


          return res.end(
            JSON.stringify(r)
          );
        }


        /* WEBHOOK */

        if (
          req.method ===
            "POST" &&
          req.url ===
            "/webhook"
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
                  JSON.parse(
                    body
                  );

                await handle(
                  update
                );

              } catch (e) {

                console.error(
                  "Webhook error:",
                  e
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


        /* NOT FOUND */

        res.writeHead(
          404
        );

        res.end(
          "Not found"
        );

      } catch (e) {

        console.error(e);

        res.writeHead(
          500
        );

        res.end(
          "Server error"
        );
      }
    }
  );


server.listen(
  PORT,
  () => {

    console.log(
      `JadoMovie Bot listening on ${PORT}`
    );

  }
);
