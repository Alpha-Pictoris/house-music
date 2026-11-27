# Texting the video reference

*Playable discovery. The film is a sample until the footage is cut.*

## The blue label

The cassette on **EH/98/041** has a white Environmental Health label. Lift it and the blue Housing stores label underneath gives **HO/78/017**. A telephone number is written beside it by hand.

Send that number any text. One text comes back.

> Record Office: Rigger's Yard video. Catalogue reference AV/98/019.

The register of deposits **RO/98/012** says what the reference is for. It records a video cassette left at the counter on 12 November for the Rigger’s Yard file, with no label and no name.

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

A number that texts twice within two minutes gets one reply. The archive answers 400 texts in all unless the ceiling is changed. It keeps a keyed digest of each number for those two minutes and never the number. Twilio answers STOP, START and HELP itself, and the archive stays quiet for those words. One connection can take ten tickets an hour.

[Run the archive locally](cassette-player-plan.md) · [Answering texts](../../archive-worker/reference-texts.js) · [Reader’s ticket](../../archive-worker/reader-ticket.js)
