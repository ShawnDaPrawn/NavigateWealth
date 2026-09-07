/**
 * A ceiling on the size of any single tracked file.
 *
 * WHY THIS EXISTS. `src/assets` holds Figma exports at camera resolution — the
 * largest is 31 MB — and they are tracked, so every clone and every CI checkout
 * pays for them whether or not the build ever reads them. The build does not:
 * `figmaAssetResolver` prefers a generated `.webp`, then a committed `.webp` /
 * `.avif` / `.jpg` sibling, and only falls through to the original. For most of
 * these the original is archival weight and nothing more.
 *
 * That weight is already paid and this test does not try to claw it back —
 * removing it means rewriting history, which is a separate, announced decision
 * (see `docs/STATUS.md`). What this test does is stop it growing: a new export
 * dropped in at full camera resolution fails here rather than being noticed a
 * year later when someone wonders why a clone takes four minutes.
 *
 * HOW TO RESPOND WHEN THIS FAILS. Do not raise the cap. Commit a web-sized
 * sibling next to the original — the resolver picks it up with no code change —
 * or export at a sane resolution in the first place. Nothing in this app renders
 * wider than about 1440 CSS px, so 2200px wide is generous.
 *
 * The cap is deliberately set above the current maximum rather than at it. A
 * ratchet pinned exactly to today's worst offender fails on the next unrelated
 * change and trains people to edit the number, which is how a gate stops being
 * a gate. `quality/baselines/` holds the counters that DO ratchet to the exact
 * number; this is a ceiling, not a counter.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../..');

/** Nothing tracked may exceed this. See the note above before changing it. */
const MAX_TRACKED_FILE_BYTES = 32 * 1024 * 1024;

/**
 * Anything newly added under these paths gets a tighter cap, because these are
 * the directories where an oversized file is a mistake rather than a legacy.
 */
const WEB_ASSET_DIRS = ['src/assets/', 'public/'];
const MAX_NEW_WEB_ASSET_BYTES = 2 * 1024 * 1024;

/**
 * Files already over the web-asset cap when it was introduced, with the size
 * each had at that moment.
 *
 * **The recorded number is the point.** An earlier version of this list held
 * paths only, which exempted those paths from the cap entirely — any of these
 * 65 files could then have been replaced by something up to the hard ceiling
 * and this test would still have passed. A 2.2 MB export could have grown
 * fourteenfold inside its own exemption, which is the exact regression the
 * file exists to prevent.
 *
 * So each entry is a ceiling for that file, not a licence. A grandfathered file
 * may shrink or stay put; it may not grow. When one drops under the global cap,
 * delete its line — the test says so, because a list that keeps entries it no
 * longer needs stops describing anything.
 */
const GRANDFATHERED: Readonly<Record<string, number>> = {
  'src/assets/fc6a85769d1248cdde73b1d2252674e730f0655a.png': 32509104,
  'src/assets/eae92cb5e7bd56806577215e734f8b397daa3e46.png': 30084737,
  'src/assets/482a45127e501f4b3cecd244241cff6024f47011.png': 29963563,
  'src/assets/5c0f670827aa0d401dd409a6c603459c23b5c4a3.png': 29329261,
  'src/assets/d0fa22ed135e395dabc605d8378a0fbcd5642ed7.png': 28849529,
  'src/assets/c6ebf07ce2d2b7d5973be0c78b41cc2d3efbcf39.png': 28171050,
  'src/assets/708b0e7710c401ef95a1826b60aa1fa5c231ef80.png': 28097240,
  'src/assets/0a60effb7ee71f5609f910b26a2203fd47255d98.png': 26360113,
  'src/assets/06f4f0d6aa6b0eb2450e2a43380c2e2d29ad658b.png': 22855121,
  'src/assets/654751ca8be2c3a6b86cd56b21742e6d3ec469ec.png': 21922256,
  'src/assets/793671a4751683b2272084a4fbc7762f16d67490.png': 21579556,
  'src/assets/46902e1b4e7cc612eaf07c17fb1352b7bdb1d876.png': 20312003,
  'src/assets/689d26eedad1e179b7cb6a7e0aeb42b33aac8696.png': 17821088,
  'src/assets/dc2935371f93dc2f6da2f85cfa093001ca172d63.png': 17632403,
  'src/assets/8c5fa58881863a67095e8aa29afc660f5cecd4d5.png': 17138675,
  'src/assets/dc7d1f92bcbe7857fe86f217588dc8719ba5a2f9.png': 17094778,
  'src/assets/3d217dec77363c6bc2c7322ec7ce8c6e59f53f53.png': 16475005,
  'src/assets/db05bf347ddb2b3ee326a6593ba2e53e220a8b57.png': 16333972,
  'src/assets/3adf41eeb556dca874c10a95709eda0ec378bf9e.png': 16275607,
  'src/assets/89c93e439f4cc9d1a730de65d575c3c6f2e060ec.png': 15984646,
  'src/assets/e7d418f9f6e2453bebdad7920dc5d338fc768fd4.png': 15525107,
  'src/assets/f4dccabf483213a63e0d519849049eacfd949bcb.png': 15451615,
  'src/assets/f9768bc43fd98373704bc54f70b3ea6ec0c8f020.png': 15397824,
  'src/assets/1f32a99aadd795f3c7f5c530f916c758d6ccb6f0.png': 14852924,
  'src/assets/842567497fa9b90bb6a11f4a8cd2092a0355be3e.png': 14528313,
  'src/assets/ba894cd523cb809fc58fbe47532929eda12b50da.png': 12229831,
  'src/assets/95a72733c6fb1b2e130e44b33bbad76a781daa85.png': 12196232,
  'src/assets/8a93f2fa219696290136738d0dc439f43b6c6235.png': 11891988,
  'src/assets/4edbc4d460d0ae6f679b5227752c118d5306e279.png': 11549186,
  'src/assets/b6c49e3128a8d7c0869121962a0c8a9836a4fef6.png': 11542392,
  'src/assets/61c60b4a45c33d3564e85aaf184ff3f3b9db37f8.png': 10972288,
  'src/assets/0e2b917f64eba502a24068ea5244bd25b0dfc9d5.png': 10953264,
  'src/assets/365200c034a353b5beb7a8f5a03c2a1a537c101b.png': 10910265,
  'src/assets/3a20bd72e539d6d53bb18a444a908939ce9db465.png': 10753388,
  'src/assets/58e37d5523feb65e353e0ac15275fd8643fc65e9.png': 10572006,
  'src/assets/c9d654dd575becaa809d4d9ce31d124144ee1c67.png': 10068668,
  'src/assets/f7f8a616cb10a78c61dfc9f8e66eeefbfeac413c.png': 9659528,
  'src/assets/623b0c66ffd502c662b87b4c531d9fe340d2de88.png': 9600935,
  'src/assets/735ec93e5649f0d2d281ac7aa06355a572058b48.png': 9518391,
  'src/assets/ec64cc77fab63db12f681738be6d7e622f955e8c.png': 9285133,
  'src/assets/974aab623b920eed5028b31b90f6ad78d88b7922.png': 9273923,
  'src/assets/a0ab0fcb56ab81f6626ad7140dbe807624f853ff.png': 8910542,
  'src/assets/4660d44f48d1f87bfd648cf720e5e52343bf1111.png': 8300245,
  'src/assets/d4773239f38262d45a5cc90213a838df6446dc6c.png': 8191122,
  'src/assets/0eb19d8516137ad854c3e1eff7fd832575e13bbe.png': 8156731,
  'src/assets/cfc1e439140eb46cc77ba92fad420182d167227d.png': 7535526,
  'src/assets/b0b37f186d8c48117bede379a79e329626b6ac95.png': 7509801,
  'src/assets/f418e978309128b782201b6c4f142b6e0a20d482.png': 7374835,
  'src/assets/4dff620ccf41d937ddc51c69e7668b15889a633c.png': 7323709,
  'src/assets/06a90a7204a3a0765a6ffe95ae6db0a382ea2312.png': 6908388,
  'src/assets/a5b12012f06f21058abb49ed8e43bf599d968395.png': 6627323,
  'src/assets/7f39ab25c8d51c8647ca73dc5c9126b4df46a0c6.png': 6159380,
  'src/assets/74818eb79f7881c1d63c16c0c2426eec343dfd42.png': 5982823,
  'src/assets/7f33deddff0f6240cb18dcef045f830436c30355.png': 5941952,
  'src/assets/cd48e241eab530d5767067af7cde123eed9c55d0.png': 5438426,
  'src/assets/6c666aace2acbb23684f35d02f79057dd364f5c6.png': 5369278,
  'src/assets/d84d9d4e620a44dabbbe1f028d18b3312e2327c0.png': 5239609,
  'src/assets/e687c01861aee919fa24cf06bfbd5e069af5249c.png': 4973570,
  'src/assets/cdaed82d69fb87a2a9ba8ab94b6ed69c92ae131f.png': 4904974,
  'src/assets/9b5a01c260b3e9de54fd63026cbbfdec6cfc0d79.png': 4654530,
  'src/assets/05476d116bd826bed8f620f9ca8ef63eeaa74a6f.png': 4594909,
  'src/assets/92b794db8aaf43fddd94915592627908c2f21176.png': 4321517,
  'src/assets/76fc906be4d2c342ff5272cc2c0d901ad65ff7f6.png': 4100745,
  'src/assets/00f21f624e8160ae5a1793de40e7c0e7ba1ee60d.png': 3522136,
  'src/assets/47655f7ea49b8154455dbaefe83366869b59cabb.png': 2343873,
};

function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

function sizeOf(relativePath: string): number {
  try {
    return statSync(join(repoRoot, relativePath)).size;
  } catch {
    return 0; // deleted in the working tree; not this test's business
  }
}

describe('tracked file size', () => {
  const files = trackedFiles();

  it('finds tracked files (guards against the listing silently failing)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('has no tracked file above the hard ceiling', () => {
    const oversized = files
      .map((f) => ({ file: f, bytes: sizeOf(f) }))
      .filter(({ bytes }) => bytes > MAX_TRACKED_FILE_BYTES)
      .sort((a, b) => b.bytes - a.bytes)
      .map(({ file, bytes }) => `${(bytes / 1024 / 1024).toFixed(1)} MB  ${file}`);

    expect(
      oversized,
      'Commit a web-sized sibling rather than raising the cap — see the note at the top of this file.',
    ).toEqual([]);
  });

  it('has no NEW web asset above the web-asset cap', () => {
    const offenders = files
      .filter((f) => WEB_ASSET_DIRS.some((d) => f.startsWith(d)))
      .filter((f) => !(f in GRANDFATHERED))
      .map((f) => ({ file: f, bytes: sizeOf(f) }))
      .filter(({ bytes }) => bytes > MAX_NEW_WEB_ASSET_BYTES)
      .sort((a, b) => b.bytes - a.bytes)
      .map(({ file, bytes }) => `${(bytes / 1024 / 1024).toFixed(1)} MB  ${file}`);

    expect(
      offenders,
      'A web asset over 2 MB reaches every visitor on the cold path. Export at 2200px or commit a sibling.',
    ).toEqual([]);
  });

  it('has no grandfathered asset that grew past its recorded size', () => {
    const grown = Object.entries(GRANDFATHERED)
      .map(([file, allowed]) => ({ file, allowed, bytes: sizeOf(file) }))
      .filter(({ bytes, allowed }) => bytes > allowed)
      .sort((a, b) => b.bytes - a.bytes)
      .map(
        ({ file, bytes, allowed }) =>
          `${(bytes / 1024 / 1024).toFixed(2)} MB (was ${(allowed / 1024 / 1024).toFixed(2)} MB)  ${file}`,
      );

    expect(
      grown,
      'A grandfathered file is exempt at the size it had, not at any size. Shrink it, or commit a smaller sibling.',
    ).toEqual([]);
  });

  it('has no stale grandfather entry', () => {
    const stale = Object.keys(GRANDFATHERED)
      .filter((file) => {
        const bytes = sizeOf(file);
        return bytes > 0 && bytes <= MAX_NEW_WEB_ASSET_BYTES;
      })
      .map((file) => `${file} is now under the cap — delete its line from GRANDFATHERED`);

    const removed = Object.keys(GRANDFATHERED)
      .filter((file) => sizeOf(file) === 0)
      .map((file) => `${file} no longer exists — delete its line from GRANDFATHERED`);

    expect(
      [...stale, ...removed],
      'The exception list must only ever get shorter. Paying debt down means deleting the line, not leaving it.',
    ).toEqual([]);
  });
});
