# Texting the video reference

*Playable discovery. The film is a sample until the footage is cut.*

## The register

The officer’s visit on **EH/98/041** files its receipt under **RO/98/012**. Searching for that reference opens the register of deposits. The week’s receipts include a video cassette left at the counter on 12 November for the Rigger’s Yard file, with no label and no name. The entry gives no reference.

Below the extract, the Record Office asks for a mobile number and offers **Text me the reference**. It names the sender beside the button and sends one text.

> Record Office: Rigger's Yard video. Catalogue reference AV/98/019. Reply STOP to unsubscribe.

The page confirms the request and never shows the reference once texting is switched on. Until then it shows the text it would have sent, so the trail can still be followed.

## The film

Searching for **AV/98/019** opens the video cassette. The film shows the address of the next machine as an `ssh` command. The captions and the transcript carry the same command. The sample film shows `ssh -p 2222 reader@board.example`.

## The reader’s ticket

The cassette sleeve has a Record Office label, like the tape on EH/98/041. Lift it and a reader’s ticket lies underneath. **Take the ticket** downloads `readers-ticket.zip`.

| File | What it is |
| --- | --- |
| `readers-ticket` | The key `ssh` presents |
| `readers-ticket-cert.pub` | The Record Office’s signature admitting that key for 30 days |
| `readers-ticket.txt` | How to show the ticket |

Unzip the three files into one folder and add `-i readers-ticket` to the command in the film.

```sh
ssh -i readers-ticket -p 2222 reader@board.example
```

A visitor carrying a house gets a ticket made out to their cassette, such as `041a / 51EA-8814 · The blue room`. The board logs that name when the ticket is shown. Other visitors get a ticket marked `reference copy`.

## Limits

A UK mobile number can ask for one text every 15 minutes. One connection can ask five times an hour and take ten tickets an hour. The archive keeps a keyed digest of each number with the time, the wording shown beside the button and Twilio’s message reference. It does not keep the number. A number that replies STOP is left alone for a day, and Twilio keeps refusing it until it replies START.

[Run the archive locally](cassette-player-plan.md) · [Text requests](../../archive-worker/reference-texts.js) · [Reader’s ticket](../../archive-worker/reader-ticket.js)
