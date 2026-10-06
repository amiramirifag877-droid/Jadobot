const http = require("http");
const crypto = require("crypto");

/* =========================================================
   JadoMovie Publisher Bot
   ========================================================= */

const BOT_TOKEN =
  process.env.BOT_TOKEN ||
  "8802340831:AAHdNczEj3G8wJhH0KtCsPMvqXPH6iNIRoY";

const OWNER_ID = "8639455918";

const BOT_USERNAME =
  "Managerjadomutbot";

const DEFAULT_CHANNEL =
  "@JadoMovie";

const PORT =
  Number(process.env.PORT || 10000);


/* =========================================================
   STORAGE
   ========================================================= */

const admins =
  new Set();

const states =
  new Map();

const channels =
  new Map();

const downloads =
  new Map();

/*
  Premium Emoji هایی که از پیام نمونه
  تشخیص داده می‌شوند.

  ساختار:

  {
    id: "5937999673510858217",
    emoji: "🎬"
  }
*/
let premiumEmojis = [];


/* =========================================================
   DEFAULT CHANNEL
   ========================================================= */

channels.set(
  DEFAULT_CHANNEL,
  {
    id: DEFAULT_CHANNEL,
    username: DEFAULT_CHANNEL,
    title: "JadoMovie"
  }
);


/* =========================================================
   FALLBACK PREMIUM EMOJIS
   اگر هنوز نمونه نفرستاده باشی
   ========================================================= */

const FALLBACK_EMOJIS = [
  {
    id: "5937999673510858217",
    emoji: "🎬"
  },
  {
    id: "5911002797578396680",
    emoji: "🎞️"
  },
  {
    id: "5987875234638730248",
    emoji: "🌐"
  },
  {
    id: "6032625495328165724",
    emoji: "🎭"
  },
  {
    id: "5886436057091673541",
    emoji: "💬"
  },
  {
    id: "5870753782874246579",
    emoji: "✍️"
  },
  {
    id: "5258336354642697821",
    emoji: "🎙️"
  },
  {
    id: "5877468380125990242",
    emoji: "📣"
  },
  {
    id: "5897554554894946515",
    emoji: "⬇️"
  },
  {
    id: "6028346797368283073",
    emoji: "⭐"
  }
];


/* =========================================================
   TELEGRAM API
   ========================================================= */

async function tg(
  method,
  body = {}
) {

  try {

    const response =
      await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
        {
          method: "POST",

          headers: {
            "content-type":
              "application/json"
          },

          body:
            JSON.stringify(body)
        }
      );

    const data =
      await response.json();

    if (!data.ok) {

      console.error(
        `Telegram API Error [${method}]:`,
        data.description
      );

    }

    return data;

  } catch (error) {

    console.error(
      "Telegram API Error:",
      error
    );

    return {
      ok: false,
      description:
        error.message
    };
  }
}


/* =========================================================
   HELPERS
   ========================================================= */

function isAdmin(id) {

  return (
    String(id) === OWNER_ID ||
    admins.has(String(id))
  );

}


function esc(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    );

}


function escAttr(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    );

}


function validUrl(
  url
) {

  return /^https?:\/\/\S+$/i.test(
    String(
      url || ""
    ).trim()
  );

}


async function send(
  chatId,
  text,
  extra = {}
) {

  return tg(
    "sendMessage",
    {
      chat_id:
        chatId,

      text,

      parse_mode:
        "HTML",

      ...extra
    }
  );

}


/* =========================================================
   PREMIUM EMOJI DETECTION
   ========================================================= */

/*
  Telegram در Message این اطلاعات را می‌دهد:

  entities: [
    {
      type: "custom_emoji",
      offset: ...,
      length: ...,
      custom_emoji_id: "..."
    }
  ]

  ما ID و Emoji جایگزین را از همان پیام استخراج می‌کنیم.
*/

function extractPremiumEmojis(
  msg
) {

  const entities = [
    ...(msg.entities || []),
    ...(msg.caption_entities || [])
  ]
    .filter(
      entity =>
        entity.type ===
        "custom_emoji"
    );

  if (!entities.length) {
    return [];
  }

  const text =
    msg.text ||
    msg.caption ||
    "";

  const result = [];

  for (
    const entity of entities
  ) {

    if (
      !entity.custom_emoji_id
    ) {
      continue;
    }

    /*
      offset و length تلگرام
      بر اساس UTF-16 هستند و
      JavaScript String نیز همین
      واحد را استفاده می‌کند.
    */

    const emoji =
      text.slice(
        entity.offset,
        entity.offset +
          entity.length
      );

    result.push({
      id:
        String(
          entity.custom_emoji_id
        ),

      emoji:
        emoji || "⭐"
    });

  }

  return result;
}


/*
  تشخیص خودکار Premium Emoji
*/

function detectAndSavePremiumEmojis(
  msg
) {

  const detected =
    extractPremiumEmojis(
      msg
    );

  if (!detected.length) {
    return false;
  }

  /*
    جلوگیری از duplicate
  */

  const map =
    new Map();

  for (
    const item of [
      ...premiumEmojis,
      ...detected
    ]
  ) {

    if (
      !map.has(item.id)
    ) {

      map.set(
        item.id,
        item
      );

    }

  }

  premiumEmojis =
    [...map.values()]
      .slice(0, 10);

  return true;
}


/*
  اگر هنوز نمونه‌ای ارسال نشده،
  از IDهایی که خودت دادی استفاده می‌کنیم.
*/

function getPremiumEmoji(
  index
) {

  const source =
    premiumEmojis.length
      ? premiumEmojis
      : FALLBACK_EMOJIS;

  return (
    source[index] ||
    FALLBACK_EMOJIS[index] ||
    {
      id: "",
      emoji: "⭐"
    }
  );
}


/* =========================================================
   CAPTION ENTITY BUILDER
   ========================================================= */

function createCaptionBuilder() {

  let text = "";

  const entities = [];

  function add(
    value
  ) {

    text +=
      String(value);

  }


  function addEntity(
    value,
    type,
    extra = {}
  ) {

    const start =
      text.length;

    const valueText =
      String(value);

    text +=
      valueText;

    entities.push({
      type,

      offset:
        start,

      length:
        valueText.length,

      ...extra
    });

  }


  function addPremium(
    emoji,
    customEmojiId
  ) {

    const value =
      emoji || "⭐";

    const start =
      text.length;

    text +=
      value;

    entities.push({
      type:
        "custom_emoji",

      offset:
        start,

      length:
        value.length,

      custom_emoji_id:
        String(
          customEmojiId
        )
    });

  }


  return {
    get text() {
      return text;
    },

    get entities() {
      return entities;
    },

    add,

    addEntity,

    addPremium
  };

}


/* =========================================================
   CREATE POST CAPTION
   ========================================================= */

function buildPost(
  state
) {

  /*
    Premium Emoji mapping

    0 = فیلم
    1 = Movie
    2 = محصول
    3 = ژانر
    4 = خلاصه
    5 = زیرنویس
    6 = دوبله
    7 = کانال
    8 = دانلود
    9 = IMDb
  */

  const eFilm =
    getPremiumEmoji(0);

  const eMovie =
    getPremiumEmoji(1);

  const eCountry =
    getPremiumEmoji(2);

  const eGenre =
    getPremiumEmoji(3);

  const eSummary =
    getPremiumEmoji(4);

  const eSubtitle =
    getPremiumEmoji(5);

  const eDub =
    getPremiumEmoji(6);

  const eChannel =
    getPremiumEmoji(7);

  const eDownload =
    getPremiumEmoji(8);

  const eImdb =
    getPremiumEmoji(9);


  const builder =
    createCaptionBuilder();


  /* =====================================================
     خط اول

     🎬 فیلم : نام فارسی | 2026
     ===================================================== */

  builder.addPremium(
    eFilm.emoji,
    eFilm.id
  );

  builder.add(
    " فیلم : "
  );

  builder.addEntity(
    state.fa,
    "bold"
  );

  builder.add(
    " | "
  );

  builder.addEntity(
    state.year,
    "bold"
  );


  builder.add(
    "\n"
  );


  /* =====================================================
     خط دوم

     🎞️ | Movie : English | IMDb ⭐ 6.6
     ===================================================== */

  builder.addPremium(
    eMovie.emoji,
    eMovie.id
  );

  builder.add(
    " | Movie : "
  );

  builder.addEntity(
    state.en,
    "bold"
  );

  builder.add(
    " | IMDb "
  );

  builder.addPremium(
    eImdb.emoji,
    eImdb.id
  );

  builder.add(
    " "
  );

  builder.addEntity(
    state.imdb,
    "bold"
  );


  builder.add(
    "\n\n"
  );


  /* =====================================================
     محصول
     ===================================================== */

  builder.addPremium(
    eCountry.emoji,
    eCountry.id
  );

  builder.add(
    " محصول : "
  );

  builder.addEntity(
    state.country,
    "bold"
  );


  builder.add(
    "\n"
  );


  /* =====================================================
     ژانر
     ===================================================== */

  builder.addPremium(
    eGenre.emoji,
    eGenre.id
  );

  builder.add(
    " ژانر : "
  );

  builder.addEntity(
    state.genre,
    "bold"
  );


  builder.add(
    "\n\n"
  );


  /* =====================================================
     خلاصه داستان

     با Blockquote
     ===================================================== */

  const quoteStart =
    builder.text.length;

  builder.addPremium(
    eSummary.emoji,
    eSummary.id
  );

  builder.add(
    " خلاصه داستان : "
  );

  builder.addEntity(
    state.summary,
    "bold"
  );

  const quoteLength =
    builder.text.length -
    quoteStart;

  builder.entities.push({
    type:
      "blockquote",

    offset:
      quoteStart,

    length:
      quoteLength
  });


  builder.add(
    "\n\n"
  );


  /* =====================================================
     زیرنویس
     ===================================================== */

  if (state.sub) {

    builder.addPremium(
      eSubtitle.emoji,
      eSubtitle.id
    );

    builder.add(
      " زیرنویس فارسی :"
    );

    builder.add(
      "\n"
    );

    builder.addPremium(
      eDownload.emoji,
      eDownload.id
    );

    builder.add(
      " "
    );

    const subtitleText =
      "(برای دانلود اینجا کلیک کنید)";

    builder.addEntity(
      subtitleText,
      "text_link",
      {
        url:
          state.sub
      }
    );

    builder.add(
      "\n\n"
    );

  }


  /* =====================================================
     دوبله
     ===================================================== */

  if (state.dub) {

    builder.addPremium(
      eDub.emoji,
      eDub.id
    );

    builder.add(
      " دوبله فارسی :"
    );

    builder.add(
      "\n"
    );

    builder.addPremium(
      eDownload.emoji,
      eDownload.id
    );

    builder.add(
      " "
    );

    const dubText =
      "(برای دانلود اینجا کلیک کنید)";

    builder.addEntity(
      dubText,
      "text_link",
      {
        url:
          state.dub
      }
    );

    builder.add(
      "\n\n"
    );

  }


  /* =====================================================
     کانال
     ===================================================== */

  const channelName =
    String(
      state.channel?.username ||
      DEFAULT_CHANNEL
    ).replace(
      /^@/,
      ""
    );


  builder.addPremium(
    eChannel.emoji,
    eChannel.id
  );

  builder.add(
    " @"
  );

  builder.add(
    channelName
  );


  return {
    text:
      builder.text,

    entities:
      builder.entities
  };

}


/* =========================================================
   MAIN MENU
   ========================================================= */

async function startMenu(
  chatId,
  uid
) {

  states.set(
    String(uid),
    {
      step:
        "choose_channel",

      chatId
    }
  );


  const buttons =
    [...channels.values()]
      .map(
        channel => [
          {
            text:
              channel.title ||
              channel.username,

            callback_data:
              "channel:" +
              String(channel.id)
          }
        ]
      );


  return send(
    chatId,

    "کانالی که می‌خواهی پست در آن منتشر شود را انتخاب کن:",

    {
      reply_markup: {
        inline_keyboard:
          buttons
      }
    }
  );

}


/* =========================================================
   UPDATE HANDLER
   ========================================================= */

async function handle(
  update
) {


  /* =====================================================
     CALLBACK
     ===================================================== */

  if (
    update.callback_query
  ) {

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


    if (
      !isAdmin(uid)
    ) {
      return;
    }


    if (
      q.data?.startsWith(
        "channel:"
      )
    ) {

      const key =
        q.data.slice(
          "channel:".length
        );


      const channel =
        [...channels.values()]
          .find(
            c =>
              String(c.id) ===
              String(key)
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
          step:
            "poster",

          chatId,

          channel
        }
      );


      return send(
        chatId,
        "مرحله ۱/۱۰\n\nپوستر فیلم را به صورت عکس ارسال کن."
      );

    }

    return;
  }


  /* =====================================================
     MESSAGE
     ===================================================== */

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


  /* =====================================================
     تشخیص خودکار Premium Emoji
     ===================================================== */

  const detected =
    detectAndSavePremiumEmojis(
      msg
    );


  /*
    اگر کاربر Premium Emoji فرستاد
    و هنوز در یک فرآیند ورود اطلاعات نیست،
    به او اطلاع می‌دهیم.
  */

  if (
    detected &&
    !states.has(String(uid)) &&
    isAdmin(uid)
  ) {

    await send(
      chatId,
      "Premium Emojiها شناسایی و ذخیره شدند ✅\n\nاز همین ایموجی‌ها در قالب پست استفاده می‌کنم."
    );

  }


  /* =====================================================
     START
     ===================================================== */

  if (
    msg.text?.startsWith(
      "/start"
    )
  ) {

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


  /* =====================================================
     CANCEL
     ===================================================== */

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


  /* =====================================================
     MENU
     ===================================================== */

  if (
    msg.text ===
      "/menu" &&
    isAdmin(uid)
  ) {

    return startMenu(
      chatId,
      uid
    );

  }


  /* =====================================================
     نمایش Premium Emojiهای ذخیره شده
     ===================================================== */

  if (
    msg.text ===
      "/emoji" &&
    isAdmin(uid)
  ) {

    if (
      !premiumEmojis.length
    ) {

      return send(
        chatId,
        "هنوز Premium Emojiای شناسایی نشده.\n\nیک پیام نمونه که داخلش Premium Emoji دارد برای من بفرست."
      );

    }


    return send(
      chatId,

      `Premium Emojiهای شناسایی‌شده:

${premiumEmojis
  .map(
    (item, index) =>
      `${index + 1}. ${item.emoji} — ${item.id}`
  )
  .join("\n")}`
    );

  }


  /* =====================================================
     ADMIN COMMANDS
     ===================================================== */

  if (
    msg.text ===
      "/addadmin" &&
    String(uid) ===
      OWNER_ID
  ) {

    states.set(
      String(uid),
      {
        step:
          "addadmin",

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
        step:
          "deladmin",

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

      `مالک: ${OWNER_ID}

ادمین‌ها:

${
  [...admins].join("\n") ||
  "موردی ثبت نشده."
}`
    );

  }


  /* =====================================================
     ADD CHANNEL
     ===================================================== */

  if (
    msg.text ===
      "/addchannel" &&
    isAdmin(uid)
  ) {

    states.set(
      String(uid),
      {
        step:
          "addchannel",

        chatId
      }
    );


    return send(
      chatId,
      "یوزرنیم کانال را بفرست.\n\nمثال:\n@JadoMovie\n\nربات باید در کانال ادمین باشد."
    );

  }


  /* =====================================================
     CHANNEL LIST
     ===================================================== */

  if (
    msg.text ===
      "/channels" &&
    isAdmin(uid)
  ) {

    const list =
      [...channels.values()]
        .map(
          c =>
            `${c.title} — ${c.username}`
        )
        .join("\n");


    return send(
      chatId,
      list ||
        "کانالی ثبت نشده."
    );

  }


  /* =====================================================
     ADMIN CHECK
     ===================================================== */

  if (
    !isAdmin(uid)
  ) {
    return;
  }


  const state =
    states.get(
      String(uid)
    );


  if (!state) {
    return;
  }


  /* =====================================================
     ADD ADMIN
     ===================================================== */

  if (
    state.step ===
      "addadmin" &&
    msg.text &&
    String(uid) ===
      OWNER_ID
  ) {

    const id =
      msg.text.trim();


    if (
      !/^\d+$/.test(id)
    ) {

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


  /* =====================================================
     DELETE ADMIN
     ===================================================== */

  if (
    state.step ===
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
      "ادمین با موفقیت حذف شد ✅"
    );

  }


  /* =====================================================
     ADD CHANNEL
     ===================================================== */

  if (
    state.step ===
      "addchannel" &&
    msg.text
  ) {

    const username =
      msg.text.trim();


    const result =
      await tg(
        "getChat",
        {
          chat_id:
            username
        }
      );


    if (
      !result.ok
    ) {

      return send(
        chatId,
        "کانال پیدا نشد یا ربات دسترسی ندارد.\n\nمطمئن شو ربات در کانال ادمین است."
      );

    }


    const channel = {

      id:
        result.result.id,

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

      `کانال «${esc(
        channel.title
      )}» با موفقیت اضافه شد ✅`
    );

  }


  /* =====================================================
     POSTER
     ===================================================== */

  if (
    state.step ===
      "poster"
  ) {

    if (
      !msg.photo?.length
    ) {

      return send(
        chatId,
        "لطفاً پوستر را به صورت عکس ارسال کن."
      );

    }


    state.poster =
      msg.photo[
        msg.photo.length - 1
      ].file_id;


    state.step =
      "fa";


    states.set(
      String(uid),
      state
    );


    return send(
      chatId,

      "مرحله ۲/۱۰\n\nاسم فارسی فیلم را بفرست."
    );

  }


  /* =====================================================
     PERSIAN NAME
     ===================================================== */

  if (
    state.step ===
      "fa"
  ) {

    if (
      !msg.text
    ) {

      return send(
        chatId,
        "اسم فارسی فیلم را به صورت متن ارسال کن."
      );

    }


    const value =
      msg.text.trim();


    if (!value) {

      return send(
        chatId,
        "اسم فارسی نمی‌تواند خالی باشد."
      );

    }


    state.fa =
      value;


    state.step =
      "year";


    states.set(
      String(uid),
      state
    );


    return send(
      chatId,

      "مرحله ۳/۱۰\n\nسال ساخت فیلم را بفرست.\n\nمثال: 2026"
    );

  }


  /* =====================================================
     YEAR
     ===================================================== */

  if (
    state.step ===
      "year"
  ) {

    if (
      !msg.text
    ) {
      return;
    }


    const year =
      msg.text.trim();


    if (
      !/^\d{4}$/.test(
        year
      )
    ) {

      return send(
        chatId,
        "سال ساخت باید چهار رقمی باشد.\n\nمثال: 2026"
      );

    }


    state.year =
      year;


    state.step =
      "en";


    states.set(
      String(uid),
      state
    );


    return send(
      chatId,

      "مرحله ۴/۱۰\n\nاسم انگلیسی فیلم را بفرست."
    );

  }


  /* =====================================================
     ENGLISH NAME
     ===================================================== */

  if (
    state.step ===
      "en"
  ) {

    if (
      !msg.text
    ) {
      return;
    }


    const value =
      msg.text.trim();


    if (!value) {

      return send(
        chatId,
        "اسم انگلیسی نمی‌تواند خالی باشد."
      );

    }


    state.en =
      value;


    state.step =
      "imdb";


    states.set(
      String(uid),
      state
    );


    return send(
      chatId,

      "مرحله ۵/۱۰\n\nامتیاز IMDb را بفرست.\n\nمثال: 6.6"
    );

  }


  /* =====================================================
     IMDb
     ===================================================== */

  if (
    state.step ===
      "imdb"
  ) {

    if (
      !msg.text
    ) {
      return;
    }


    const value =
      msg.text
        .trim()
        .replace(
          ",",
          "."
        );


    const number =
      Number(value);


    if (
      !Number.isFinite(
        number
      ) ||
      number < 0 ||
      number > 10
    ) {

      return send(
        chatId,
        "امتیاز IMDb معتبر نیست.\n\nمثال: 6.6"
      );

    }


    state.imdb =
      value;


    state.step =
      "country";


    states.set(
      String(uid),
      state
    );


    return send(
      chatId,

      "مرحله ۶/۱۰\n\nکشور سازنده را بفرست."
    );

  }


  /* =====================================================
     COUNTRY
     ===================================================== */

  if (
    state.step ===
      "country"
  ) {

    if (
      !msg.text
    ) {
      return;
    }


    const value =
      msg.text.trim();


    if (!value) {

      return send(
        chatId,
        "کشور سازنده نمی‌تواند خالی باشد."
      );

    }


    state.country =
      value;


    state.step =
      "genre";


    states.set(
      String(uid),
      state
    );


    return send(
      chatId,

      "مرحله ۷/۱۰\n\nژانر را بفرست.\n\nمثال:\nاکشن، هیجان‌انگیز، کمدی"
    );

  }


  /* =====================================================
     GENRE
     ===================================================== */

  if (
    state.step ===
      "genre"
  ) {

    if (
      !msg.text
    ) {
      return;
    }


    const value =
      msg.text.trim();


    if (!value) {

      return send(
        chatId,
        "ژانر نمی‌تواند خالی باشد."
      );

    }


    state.genre =
      value;


    state.step =
      "summary";


    states.set(
      String(uid),
      state
    );


    return send(
      chatId,

      "مرحله ۸/۱۰\n\nخلاصه داستان را بفرست."
    );

  }


  /* =====================================================
     SUMMARY
     ===================================================== */

  if (
    state.step ===
      "summary"
  ) {

    if (
      !msg.text
    ) {
      return;
    }


    const value =
      msg.text.trim();


    if (!value) {

      return send(
        chatId,
        "خلاصه داستان نمی‌تواند خالی باشد."
      );

    }


    state.summary =
      value;


    state.step =
      "type";


    states.set(
      String(uid),
      state
    );


    return send(
      chatId,

      "مرحله ۹/۱۰\n\nنوع دانلود را انتخاب کن:",

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
            true,

          one_time_keyboard:
            true
        }
      }
    );

  }


  /* =====================================================
     DOWNLOAD TYPE
     ===================================================== */

  if (
    state.step ===
      "type"
  ) {

    if (
      !msg.text
    ) {
      return;
    }


    const type =
      msg.text.trim();


    if (
      ![
        "فقط زیرنویس",
        "فقط دوبله",
        "هر دو"
      ].includes(type)
    ) {

      return send(
        chatId,
        "یکی از گزینه‌های زیر را انتخاب کن:\n\nفقط زیرنویس\nفقط دوبله\nهر دو"
      );

    }


    state.type =
      type;


    const removeKeyboard = {
      reply_markup: {
        remove_keyboard:
          true
      }
    };


    /* فقط زیرنویس */

    if (
      type ===
        "فقط زیرنویس"
    ) {

      state.step =
        "sub";


      states.set(
        String(uid),
        state
      );


      return send(
        chatId,

        "مرحله ۱۰/۱۰\n\nلینک دانلود زیرنویس فارسی را ارسال کن.",

        removeKeyboard
      );

    }


    /* فقط دوبله */

    if (
      type ===
        "فقط دوبله"
    ) {

      state.step =
        "dub";


      states.set(
        String(uid),
        state
      );


      return send(
        chatId,

        "مرحله ۱۰/۱۰\n\nلینک دانلود دوبله فارسی را ارسال کن.",

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

      "لینک دانلود زیرنویس فارسی را ارسال کن.",

      removeKeyboard
    );

  }


  /* =====================================================
     SUBTITLE
     ===================================================== */

  if (
    state.step ===
      "sub"
  ) {

    if (
      !msg.text
    ) {
      return;
    }


    const url =
      msg.text.trim();


    if (
      !validUrl(url)
    ) {

      return send(
        chatId,

        "❌ لینک معتبر نیست.\n\nمثال:\nhttps://example.com/subtitle"
      );

    }


    state.sub =
      url;


    if (
      state.type ===
        "هر دو"
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


  /* =====================================================
     DUB
     ===================================================== */

  if (
    state.step ===
      "dub"
  ) {

    if (
      !msg.text
    ) {
      return;
    }


    const url =
      msg.text.trim();


    if (
      !validUrl(url)
    ) {

      return send(
        chatId,

        "❌ لینک معتبر نیست.\n\nمثال:\nhttps://example.com/dub"
      );

    }


    state.dub =
      url;


    return publish(
      uid,
      state
    );

  }

}


/* =========================================================
   PUBLISH
   ========================================================= */

async function publish(
  uid,
  state
) {

  try {

    const caption =
      buildPost(
        state
      );


    /*
      sendPhoto با caption_entities

      این قسمت مهم است:
      دیگر parse_mode را استفاده نمی‌کنیم.
      Premium Emojiها مستقیماً
      به عنوان custom_emoji entity
      ارسال می‌شوند.
    */

    const result =
      await tg(
        "sendPhoto",
        {
          chat_id:
            state.channel.id,

          photo:
            state.poster,

          caption:
            caption.text,

          caption_entities:
            caption.entities
        }
      );


    states.delete(
      String(uid)
    );


    if (
      result.ok
    ) {

      return send(
        state.chatId ||
          uid,

        "پست با موفقیت در کانال منتشر شد ✅"
      );

    }


    console.error(
      "Publish error:",
      result.description
    );


    return send(
      state.chatId ||
        uid,

      `انتشار ناموفق بود ❌

${esc(
  result.description ||
  "خطای نامشخص"
)}`
    );


  } catch (error) {

    console.error(
      "Publish exception:",
      error
    );


    return send(
      state.chatId ||
        uid,

      `خطا هنگام انتشار ❌

${esc(
  error.message
)}`
    );

  }

}


/* =========================================================
   OLD DOWNLOAD SYSTEM
   ========================================================= */

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


async function sendDownload(
  chatId,
  key
) {

  const item =
    downloads.get(
      key
    );


  if (!item) {

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
        item.file_id,

      caption:
        `${item.type}\n${item.name}`
    }
  );

}


/* =========================================================
   WEBHOOK
   ========================================================= */

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


/* =========================================================
   HTTP SERVER
   ========================================================= */

const server =
  http.createServer(
    async (
      req,
      res
    ) => {

      try {


        /* =================================================
           HOME
           ================================================= */

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


        /* =================================================
           SETUP
           ================================================= */

        if (
          req.method ===
            "GET" &&
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


        /* =================================================
           WEBHOOK
           ================================================= */

        if (
          req.method ===
            "POST" &&
          req.url === "/webhook"
        ) {

          let body =
            "";


          req.on(
            "data",
            chunk => {

              body +=
                chunk;

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


              } catch (
                error
              ) {

                console.error(
                  "Webhook error:",
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


        /* =================================================
           NOT FOUND
           ================================================= */

        res.writeHead(
          404
        );


        res.end(
          "Not found"
        );


      } catch (
        error
      ) {

        console.error(
          "Server error:",
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


/* =========================================================
   START
   ========================================================= */

server.listen(
  PORT,
  () => {

    console.log(
      `JadoMovie Bot listening on ${PORT}`
    );

    console.log(
      `Channel: ${DEFAULT_CHANNEL}`
    );

  }
);
