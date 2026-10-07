const http = require("http");
const crypto = require("crypto");

/*
  توکن فعلی رباتت را اینجا قرار بده.
  برای نسخه نهایی بهتر است از Environment Variable در Render استفاده شود.
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

// گروه واسطی که پست پریمیوم ابتدا در آن ارسال می‌شود.
let premiumGroup = null;

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
  return /^https?:\/\/\S+$/i.test(String(url || "").trim());
}

function utf16Length(s) {
  return Array.from(String(s ?? "")).reduce(
    (n, ch) => n + (ch.codePointAt(0) > 0xFFFF ? 2 : 1),
    0
  );
}

function utf16Slice(s, start, length) {
  const chars = Array.from(String(s ?? ""));
  let pos = 0;
  let out = "";

  for (const ch of chars) {
    const size =
      ch.codePointAt(0) > 0xFFFF ? 2 : 1;

    if (
      pos >= start &&
      pos < start + length
    ) {
      out += ch;
    }

    pos += size;

    if (pos >= start + length) {
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

function buildJadoCaption(
  st,
  emojiList
) {
  const entities = [];
  let text = "";

  const append = value => {
    const offset = utf16Length(text);
    text += value;
    return offset;
  };

  const bold = value => {
    const offset = append(value);

    addEntity(
      entities,
      "bold",
      offset,
      utf16Length(value)
    );
  };

  const ce = (
    index,
    fallback
  ) => {
    const item = emojiList[index];

    if (!item) {
      return append(fallback);
    }

    const fb =
      item.fallback || fallback;

    const offset = append(fb);

    addEntity(
      entities,
      "custom_emoji",
      offset,
      utf16Length(fb),
      {
        custom_emoji_id:
          String(item.id)
      }
    );
  };

  ce(0, "🎬");
  append(" ");
  bold(
    `فیلم : ${st.fa} | ${st.year}`
  );
  append("\n");

  ce(1, "🎞");
  append(" ");

  bold(
    `| Movie : ${st.en} | IMDb `
  );

  ce(2, "⭐");

  bold(
    ` ${st.imdb}`
  );

  append("\n");

  ce(3, "🌍");
  append(" ");

  bold(
    `کشور : ${st.country}`
  );

  append("\n");

  ce(4, "🎭");
  append(" ");

  bold(
    `ژانر : ${st.genre}`
  );

  append("\n\n");

  const blockStart =
    append("▌ ");

  ce(5, "📖");
  append(" ");

  const story =
    String(st.summary || "");

  append(story);

  addEntity(
    entities,
    "blockquote",
    blockStart,
    utf16Length(text) - blockStart
  );

  append("\n\n");

  if (st.sub) {
    const label =
      "🔤 زیرنویس فارسی";

    const offset =
      append(label);

    addEntity(
      entities,
      "text_link",
      offset,
      utf16Length(label),
      {
        url: st.sub
      }
    );

    append("\n");
  }

  if (st.dub) {
    const label =
      "🔊 دوبله فارسی";

    const offset =
      append(label);

    addEntity(
      entities,
      "text_link",
      offset,
      utf16Length(label),
      {
        url: st.dub
      }
    );

    append("\n");
  }

  append("\n");

  bold(
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
    "مقصد انتشار پست را انتخاب کن (گروه یا کانال):",
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

  /* ---------- Callback ---------- */

  if (update.callback_query) {

    const q =
      update.callback_query;

    await tg(
      "answerCallbackQuery",
      {
        callback_query_id:
          q.id
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
            String(c.id) === key
        );

      if (!ch) {
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


  /* ---------- Message ---------- */

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

    if (
      isAdmin(uid)
    ) {
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
     ADMINS
  ========================= */

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


  if (
    msg.text ===
      "/admins" &&
    String(uid) ===
      OWNER_ID
  ) {

    return send(
      chatId,
      `مالک: ${OWNER_ID}\n\nادمین‌ها:\n${
        [...admins].join("\n") ||
        "موردی ثبت نشده."
      }`
    );
  }


  /* =========================
     CHANNELS
  ========================= */

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
      "یوزرنیم کانال را بفرست؛ مثلاً @JadoMovie\nبرای گروه از /addgroup استفاده کن.\nربات باید در کانال ادمین باشد."
    );
  }


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
      "یوزرنیم یا آیدی گروه/سوپرگروه را بفرست؛ مثلاً @JadoMovieGroup\nربات باید اجازه ارسال پیام داشته باشد."
    );
  }


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


  if (
    msg.text === "/group" &&
    isAdmin(uid)
  ) {

    return send(
      chatId,
      premiumGroup
        ? `گروه واسط فعلی: ${premiumGroup.title} — ${premiumGroup.username}`
        : "هنوز گروه واسط ثبت نشده است.\n\nبرای ثبت: /addgroup"
    );
  }


  /* =========================
     EMOJI SAMPLE
  ========================= */

  if (
    msg.text === "/emoji" &&
    isAdmin(uid)
  ) {

    states.set(
      String(uid),
      {
        step: "emoji_sample",
        chatId
      }
    );

    return send(
      chatId,
      "حالا پست نمونه‌ای که ایموجی‌های پریمیوم دارد را برای ربات فوروارد کن."
    );
  }


  /* =========================
     Admin Check
  ========================= */

  if (!isAdmin(uid)) {
    return;
  }

  const st =
    states.get(
      String(uid)
    );

  if (!st) {
    return;
  }


  /* =========================
     POSTER
  ========================= */

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


  /* =========================
     TEXT STEPS
  ========================= */

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


  /* =========================
     SUMMARY
  ========================= */

  if (
    st.step ===
      "summary" &&
    msg.text
  ) {

    st.summary =
      msg.text.trim();

    st.step =
      "type";

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


  /* =========================
     DOWNLOAD TYPE
  ========================= */

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


    /* فقط زیرنویس */

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
        "🔤 لینک دانلود زیرنویس فارسی را ارسال کن.\n\nمثال:\nhttps://example.com/subtitle"
      );
    }


    /* فقط دوبله */

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
        "🔊 لینک دانلود دوبله فارسی را ارسال کن.\n\nمثال:\nhttps://example.com/dub"
      );
    }


    /* هر دو */

    st.step =
      "sub";

    states.set(
      String(uid),
      st
    );

    return send(
      chatId,
      "🔤 لینک دانلود زیرنویس فارسی را ارسال کن.\n\nمثال:\nhttps://example.com/subtitle"
    );
  }


  /* =========================
     SUBTITLE LINK
  ========================= */

  if (
    st.step === "sub" &&
    msg.text
  ) {

    const url =
      msg.text.trim();

    if (!validUrl(url)) {

      return send(
        chatId,
        "❌ لینک معتبر نیست.\n\nلطفاً لینک زیرنویس فارسی را با http:// یا https:// ارسال کن."
      );
    }

    st.sub =
      url;


    /* اگر هر دو انتخاب شده */

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


    /* فقط زیرنویس */

    return publish(
      uid,
      st
    );
  }


  /* =========================
     DUB LINK
  ========================= */

  if (
    st.step === "dub" &&
    msg.text
  ) {

    const url =
      msg.text.trim();

    if (!validUrl(url)) {

      return send(
        chatId,
        "❌ لینک معتبر نیست.\n\nلطفاً لینک دوبله فارسی را با http:// یا https:// ارسال کن."
      );
    }

    st.dub =
      url;

    return publish(
      uid,
      st
    );
  }


  /* =========================
     PREMIUM EMOJI
  ========================= */

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

    const samples = [];
    const seen =
      new Set();

    for (
      const e of entities
    ) {

      const id =
        String(
          e.custom_emoji_id
        );

      if (
        seen.has(id)
      ) {
        continue;
      }

      seen.add(id);

      samples.push({
        id,
        fallback:
          utf16Slice(
            sourceText,
            e.offset,
            e.length
          ) || "😀"
      });
    }

    if (
      !samples.length
    ) {

      return send(
        chatId,
        "ایموجی پریمیوم قابل تشخیص پیدا نشد. پست نمونه را مستقیم یا با Forward بفرست."
      );
    }

    emojiSamples.set(
      String(uid),
      samples
    );

    states.delete(
      String(uid)
    );

    return send(
      chatId,
      `ایموجی‌های پریمیوم پیدا شد و ذخیره شد ✅\n\n${
        samples
          .map(
            (x, i) =>
              `${i + 1}. ${x.fallback}`
          )
          .join("\n")
      }\n\nحالا /menu را بزن.`
    );
  }


  /* =========================
     ADD ADMIN
  ========================= */

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


  /* =========================
     DELETE ADMIN
  ========================= */

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


  /* =========================
     ADD CHANNEL / GROUP
  ========================= */

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
        "کانال یا گروه پیدا نشد یا ربات دسترسی ندارد."
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


    /* GROUP */

    if (
      st.step ===
        "addgroup"
    ) {

      premiumGroup =
        {
          id: c.id,
          username:
            c.username,
          title:
            c.title
        };

      states.delete(
        String(uid)
      );

      return send(
        chatId,
        `گروه واسط «${c.title}» ثبت شد ✅\n\nاز این به بعد پست ابتدا در این گروه با Premium Emoji ارسال می‌شود و بعد ربات تلاش می‌کند همان پیام را به کانال کپی کند.`
      );
    }


    /* CHANNEL */

    channels.set(
      String(c.id),
      c
    );

    states.delete(
      String(uid)
    );

    return send(
      chatId,
      `کانال «${c.title}» اضافه شد ✅\nربات باید در کانال ادمین باشد.`
    );
  }
}


/* =========================
   Publish Post
========================= */

async function publish(
  uid,
  st
) {

  const replyChatId =
    st.chatId || uid;

  if (!premiumGroup) {

    return send(
      replyChatId,
      "❌ هنوز گروه واسط ثبت نشده است.\n\nاول ربات را داخل گروه/سوپرگروه موردنظر ادمین کن، سپس /addgroup را بزن و گروه را ثبت کن."
    );
  }

  const emojiList =
    emojiSamples.get(
      String(uid)
    ) || [];

  const built =
    buildJadoCaption(
      st,
      emojiList
    );


  /*
    1) ارسال مستقیم به گروه.
    اینجا Premium Emoji استفاده می‌شود.
  */

  const groupPost =
    await tg(
      "sendPhoto",
      {
        chat_id:
          premiumGroup.id,

        photo:
          st.poster,

        caption:
          built.text,

        caption_entities:
          built.entities
      }
    );


  if (
    !groupPost.ok ||
    !groupPost.result?.message_id
  ) {

    return send(
      replyChatId,
      `❌ ارسال به گروه واسط ناموفق بود.\n\n${
        groupPost.description ||
        "خطای نامشخص"
      }`
    );
  }


  /*
    2) تلاش برای کپی همان پیام
       از گروه به کانال.
  */

  const copied =
    await tg(
      "copyMessage",
      {
        chat_id:
          st.channel.id,

        from_chat_id:
          premiumGroup.id,

        message_id:
          groupPost.result
            .message_id
      }
    );


  states.delete(
    String(uid)
  );


  if (copied.ok) {

    return send(
      replyChatId,
      `پست ابتدا با Premium Emoji در «${premiumGroup.title}» ارسال شد و سپس به «${
        st.channel.title ||
        "کانال"
      }» کپی شد ✅\n\nاگر Premium Emoji در کانال نمایش داده نشد، یعنی Telegram کپی ربات→کانال را برای این نوع Emoji نپذیرفته است.`
    );
  }


  return send(
    replyChatId,
    `⚠️ پست با Premium Emoji در گروه «${premiumGroup.title}» ارسال شد، اما کپی خودکار به کانال ناموفق بود.\n\nخطای Telegram:\n${
      copied.description ||
      "خطای نامشخص"
    }\n\nپست داخل گروه باقی مانده و می‌توانی همان پیام را دستی به کانال Forward کنی.`
  );
}


/* =========================
   Old download system
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
