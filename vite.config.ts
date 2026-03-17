
import fs from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

function resolveFigmaAsset(filename: string): string {
  const assetDirectory = path.resolve(__dirname, './src/assets');
  const parsed = path.parse(filename);
  const candidates = [
    `${parsed.name}.jpg`,
    `${parsed.name}.jpeg`,
    `${parsed.name}.webp`,
    filename,
  ];

  const match = candidates.find((candidate) =>
    fs.existsSync(path.join(assetDirectory, candidate))
  );

  return path.join(assetDirectory, match ?? filename);
}

function getManualChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  if (id.includes('/react/') || id.includes('/react-dom/')) {
    return 'vendor-react';
  }

  if (id.includes('/react-router/')) {
    return 'vendor-router';
  }

  if (
    id.includes('/@supabase/supabase-js/') ||
    id.includes('/@jsr/supabase__supabase-js/')
  ) {
    return 'vendor-supabase';
  }

  if (
    id.includes('/react-hook-form/') ||
    id.includes('/@hookform/resolvers/') ||
    id.includes('/zod/')
  ) {
    return 'vendor-forms';
  }

  if (
    id.includes('/@tanstack/react-query/') ||
    id.includes('/@tanstack/react-virtual/')
  ) {
    return 'vendor-data';
  }

  if (
    id.includes('/motion/') ||
    id.includes('/sonner/') ||
    id.includes('/react-toastify/')
  ) {
    return 'vendor-feedback';
  }

  if (
    id.includes('/@hello-pangea/dnd/') ||
    id.includes('/react-dnd/') ||
    id.includes('/react-dnd-html5-backend/')
  ) {
    return 'vendor-dnd';
  }

  if (
    id.includes('/react-quill-new/') ||
    id.includes('/quill/')
  ) {
    return 'vendor-quill';
  }

  if (id.includes('/@tiptap/')) {
    return 'vendor-tiptap';
  }

  if (
    id.includes('/pdf-lib/')
  ) {
    return 'vendor-pdf-lib';
  }

  if (id.includes('/node-forge/') || id.includes('/@signpdf/')) {
    return 'vendor-signpdf';
  }

  if (id.includes('/pdfjs-dist/')) {
    return 'vendor-pdf-viewer';
  }

  if (
    id.includes('/jspdf/') ||
    id.includes('/jspdf-autotable/')
  ) {
    return 'vendor-jspdf';
  }

  if (id.includes('/docx/') || id.includes('/@zip.js/zip.js/')) {
    return 'vendor-docx';
  }

  if (id.includes('/xlsx/')) {
    return 'vendor-xlsx';
  }

  if (id.includes('/recharts/')) {
    return 'vendor-charts';
  }

  if (
    id.includes('/@radix-ui/') ||
    id.includes('/vaul/') ||
    id.includes('/cmdk/') ||
    id.includes('/input-otp/') ||
    id.includes('/embla-carousel-react/') ||
    id.includes('/react-resizable-panels/')
  ) {
    return 'vendor-ui';
  }

  if (
    id.includes('/lucide-react/') ||
    id.includes('/class-variance-authority/') ||
    id.includes('/clsx/') ||
    id.includes('/tailwind-merge/')
  ) {
    return 'vendor-foundation';
  }

  if (id.includes('/date-fns/')) {
    return 'vendor-date';
  }

  return undefined;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        'sonner@2.0.3': 'sonner',
        'react-hook-form@7.55.0': 'react-hook-form',
        'pdf-lib@1.17.1': 'pdf-lib',
        'node-forge@1.3.1': 'node-forge',
        'figma:asset/fd6511affe61694a459c9045604285d749d7eec8.png': resolveFigmaAsset('fd6511affe61694a459c9045604285d749d7eec8.png'),
        'figma:asset/fc6a85769d1248cdde73b1d2252674e730f0655a.png': resolveFigmaAsset('fc6a85769d1248cdde73b1d2252674e730f0655a.png'),
        'figma:asset/f9768bc43fd98373704bc54f70b3ea6ec0c8f020.png': resolveFigmaAsset('f9768bc43fd98373704bc54f70b3ea6ec0c8f020.png'),
        'figma:asset/f7f8a616cb10a78c61dfc9f8e66eeefbfeac413c.png': resolveFigmaAsset('f7f8a616cb10a78c61dfc9f8e66eeefbfeac413c.png'),
        'figma:asset/f4dccabf483213a63e0d519849049eacfd949bcb.png': resolveFigmaAsset('f4dccabf483213a63e0d519849049eacfd949bcb.png'),
        'figma:asset/f418e978309128b782201b6c4f142b6e0a20d482.png': resolveFigmaAsset('f418e978309128b782201b6c4f142b6e0a20d482.png'),
        'figma:asset/eeda4aac6f4cf8965f899a22c841c57c87562d12.png': resolveFigmaAsset('eeda4aac6f4cf8965f899a22c841c57c87562d12.png'),
        'figma:asset/ec64cc77fab63db12f681738be6d7e622f955e8c.png': resolveFigmaAsset('ec64cc77fab63db12f681738be6d7e622f955e8c.png'),
        'figma:asset/ec22996319fc583c67408cd6d525bfd9d80a3c28.png': resolveFigmaAsset('ec22996319fc583c67408cd6d525bfd9d80a3c28.png'),
        'figma:asset/eb0a94d1f9889b9024b3266d68e2e1ceae56294e.png': resolveFigmaAsset('eb0a94d1f9889b9024b3266d68e2e1ceae56294e.png'),
        'figma:asset/eae92cb5e7bd56806577215e734f8b397daa3e46.png': resolveFigmaAsset('eae92cb5e7bd56806577215e734f8b397daa3e46.png'),
        'figma:asset/e9ad412b6e704d27523e203d6d64cf4b018d8010.png': resolveFigmaAsset('e9ad412b6e704d27523e203d6d64cf4b018d8010.png'),
        'figma:asset/e7d418f9f6e2453bebdad7920dc5d338fc768fd4.png': resolveFigmaAsset('e7d418f9f6e2453bebdad7920dc5d338fc768fd4.png'),
        'figma:asset/e687c01861aee919fa24cf06bfbd5e069af5249c.png': resolveFigmaAsset('e687c01861aee919fa24cf06bfbd5e069af5249c.png'),
        'figma:asset/e599bccdec66ed4c52fa231161e6088f3e4c4b94.png': resolveFigmaAsset('e599bccdec66ed4c52fa231161e6088f3e4c4b94.png'),
        'figma:asset/def9c4d4fdd055d486a64e8df869988fd6a2aca3.png': resolveFigmaAsset('def9c4d4fdd055d486a64e8df869988fd6a2aca3.png'),
        'figma:asset/dc7d1f92bcbe7857fe86f217588dc8719ba5a2f9.png': resolveFigmaAsset('dc7d1f92bcbe7857fe86f217588dc8719ba5a2f9.png'),
        'figma:asset/dc2935371f93dc2f6da2f85cfa093001ca172d63.png': resolveFigmaAsset('dc2935371f93dc2f6da2f85cfa093001ca172d63.png'),
        'figma:asset/dbeb61494c13e4289499d3be7c162dbc9fb1c3bb.png': resolveFigmaAsset('dbeb61494c13e4289499d3be7c162dbc9fb1c3bb.png'),
        'figma:asset/db05bf347ddb2b3ee326a6593ba2e53e220a8b57.png': resolveFigmaAsset('db05bf347ddb2b3ee326a6593ba2e53e220a8b57.png'),
        'figma:asset/d84d9d4e620a44dabbbe1f028d18b3312e2327c0.png': resolveFigmaAsset('d84d9d4e620a44dabbbe1f028d18b3312e2327c0.png'),
        'figma:asset/d4773239f38262d45a5cc90213a838df6446dc6c.png': resolveFigmaAsset('d4773239f38262d45a5cc90213a838df6446dc6c.png'),
        'figma:asset/d0fa22ed135e395dabc605d8378a0fbcd5642ed7.png': resolveFigmaAsset('d0fa22ed135e395dabc605d8378a0fbcd5642ed7.png'),
        'figma:asset/cfc1e439140eb46cc77ba92fad420182d167227d.png': resolveFigmaAsset('cfc1e439140eb46cc77ba92fad420182d167227d.png'),
        'figma:asset/cdaed82d69fb87a2a9ba8ab94b6ed69c92ae131f.png': resolveFigmaAsset('cdaed82d69fb87a2a9ba8ab94b6ed69c92ae131f.png'),
        'figma:asset/cd48e241eab530d5767067af7cde123eed9c55d0.png': resolveFigmaAsset('cd48e241eab530d5767067af7cde123eed9c55d0.png'),
        'figma:asset/c9d654dd575becaa809d4d9ce31d124144ee1c67.png': resolveFigmaAsset('c9d654dd575becaa809d4d9ce31d124144ee1c67.png'),
        'figma:asset/c6ebf07ce2d2b7d5973be0c78b41cc2d3efbcf39.png': resolveFigmaAsset('c6ebf07ce2d2b7d5973be0c78b41cc2d3efbcf39.png'),
        'figma:asset/c505e16f603199f9f6e099328fa60863eea2b0a4.png': resolveFigmaAsset('c505e16f603199f9f6e099328fa60863eea2b0a4.png'),
        'figma:asset/babc74c9965824d11fb6fe0aa9dd0133e10fd66b.png': resolveFigmaAsset('babc74c9965824d11fb6fe0aa9dd0133e10fd66b.png'),
        'figma:asset/ba894cd523cb809fc58fbe47532929eda12b50da.png': resolveFigmaAsset('ba894cd523cb809fc58fbe47532929eda12b50da.png'),
        'figma:asset/b97811d5cc1be8c99fd6e9de8a94e3fa8dcff34a.png': resolveFigmaAsset('b97811d5cc1be8c99fd6e9de8a94e3fa8dcff34a.png'),
        'figma:asset/b6c49e3128a8d7c0869121962a0c8a9836a4fef6.png': resolveFigmaAsset('b6c49e3128a8d7c0869121962a0c8a9836a4fef6.png'),
        'figma:asset/b0b37f186d8c48117bede379a79e329626b6ac95.png': resolveFigmaAsset('b0b37f186d8c48117bede379a79e329626b6ac95.png'),
        'figma:asset/b0906bc7f1c0d8e245965e6df2752c0454fc4f4f.png': resolveFigmaAsset('b0906bc7f1c0d8e245965e6df2752c0454fc4f4f.png'),
        'figma:asset/ad6ef49da98c4f2ada1c11054e5db1894b83bf2e.png': resolveFigmaAsset('ad6ef49da98c4f2ada1c11054e5db1894b83bf2e.png'),
        'figma:asset/a5b12012f06f21058abb49ed8e43bf599d968395.png': resolveFigmaAsset('a5b12012f06f21058abb49ed8e43bf599d968395.png'),
        'figma:asset/a0ab0fcb56ab81f6626ad7140dbe807624f853ff.png': resolveFigmaAsset('a0ab0fcb56ab81f6626ad7140dbe807624f853ff.png'),
        'figma:asset/9b5a01c260b3e9de54fd63026cbbfdec6cfc0d79.png': resolveFigmaAsset('9b5a01c260b3e9de54fd63026cbbfdec6cfc0d79.png'),
        'figma:asset/974aab623b920eed5028b31b90f6ad78d88b7922.png': resolveFigmaAsset('974aab623b920eed5028b31b90f6ad78d88b7922.png'),
        'figma:asset/95a72733c6fb1b2e130e44b33bbad76a781daa85.png': resolveFigmaAsset('95a72733c6fb1b2e130e44b33bbad76a781daa85.png'),
        'figma:asset/93f99cf845ed1c9ec1d831acbc1d5f3f297e3ba5.png': resolveFigmaAsset('93f99cf845ed1c9ec1d831acbc1d5f3f297e3ba5.png'),
        'figma:asset/92b794db8aaf43fddd94915592627908c2f21176.png': resolveFigmaAsset('92b794db8aaf43fddd94915592627908c2f21176.png'),
        'figma:asset/8dc2892f50ecc4c5f692fd5ad52639699e2e4656.png': resolveFigmaAsset('8dc2892f50ecc4c5f692fd5ad52639699e2e4656.png'),
        'figma:asset/8c5fa58881863a67095e8aa29afc660f5cecd4d5.png': resolveFigmaAsset('8c5fa58881863a67095e8aa29afc660f5cecd4d5.png'),
        'figma:asset/8a93f2fa219696290136738d0dc439f43b6c6235.png': resolveFigmaAsset('8a93f2fa219696290136738d0dc439f43b6c6235.png'),
        'figma:asset/89c93e439f4cc9d1a730de65d575c3c6f2e060ec.png': resolveFigmaAsset('89c93e439f4cc9d1a730de65d575c3c6f2e060ec.png'),
        'figma:asset/842567497fa9b90bb6a11f4a8cd2092a0355be3e.png': resolveFigmaAsset('842567497fa9b90bb6a11f4a8cd2092a0355be3e.png'),
        'figma:asset/7f3a830d4aaf877636e790293960ff63a842e4fa.png': resolveFigmaAsset('7f3a830d4aaf877636e790293960ff63a842e4fa.png'),
        'figma:asset/7f39ab25c8d51c8647ca73dc5c9126b4df46a0c6.png': resolveFigmaAsset('7f39ab25c8d51c8647ca73dc5c9126b4df46a0c6.png'),
        'figma:asset/7f33deddff0f6240cb18dcef045f830436c30355.png': resolveFigmaAsset('7f33deddff0f6240cb18dcef045f830436c30355.png'),
        'figma:asset/796c1e649470eb0836626041af34ac621ac5579f.png': resolveFigmaAsset('796c1e649470eb0836626041af34ac621ac5579f.png'),
        'figma:asset/793671a4751683b2272084a4fbc7762f16d67490.png': resolveFigmaAsset('793671a4751683b2272084a4fbc7762f16d67490.png'),
        'figma:asset/76fc906be4d2c342ff5272cc2c0d901ad65ff7f6.png': resolveFigmaAsset('76fc906be4d2c342ff5272cc2c0d901ad65ff7f6.png'),
        'figma:asset/7544a9a9b8dff620a2783be94ba019a570916dc7.png': resolveFigmaAsset('7544a9a9b8dff620a2783be94ba019a570916dc7.png'),
        'figma:asset/74818eb79f7881c1d63c16c0c2426eec343dfd42.png': resolveFigmaAsset('74818eb79f7881c1d63c16c0c2426eec343dfd42.png'),
        'figma:asset/735ec93e5649f0d2d281ac7aa06355a572058b48.png': resolveFigmaAsset('735ec93e5649f0d2d281ac7aa06355a572058b48.png'),
        'figma:asset/708b0e7710c401ef95a1826b60aa1fa5c231ef80.png': resolveFigmaAsset('708b0e7710c401ef95a1826b60aa1fa5c231ef80.png'),
        'figma:asset/6c666aace2acbb23684f35d02f79057dd364f5c6.png': resolveFigmaAsset('6c666aace2acbb23684f35d02f79057dd364f5c6.png'),
        'figma:asset/689d26eedad1e179b7cb6a7e0aeb42b33aac8696.png': resolveFigmaAsset('689d26eedad1e179b7cb6a7e0aeb42b33aac8696.png'),
        'figma:asset/659a0de62953bd7f998e24115e7eb3980457ec76.png': resolveFigmaAsset('659a0de62953bd7f998e24115e7eb3980457ec76.png'),
        'figma:asset/658982ebed7e0dfaed88848d4c25d44da4ec2b0d.png': resolveFigmaAsset('658982ebed7e0dfaed88848d4c25d44da4ec2b0d.png'),
        'figma:asset/654751ca8be2c3a6b86cd56b21742e6d3ec469ec.png': resolveFigmaAsset('654751ca8be2c3a6b86cd56b21742e6d3ec469ec.png'),
        'figma:asset/623b0c66ffd502c662b87b4c531d9fe340d2de88.png': resolveFigmaAsset('623b0c66ffd502c662b87b4c531d9fe340d2de88.png'),
        'figma:asset/61c60b4a45c33d3564e85aaf184ff3f3b9db37f8.png': resolveFigmaAsset('61c60b4a45c33d3564e85aaf184ff3f3b9db37f8.png'),
        'figma:asset/5c0f670827aa0d401dd409a6c603459c23b5c4a3.png': resolveFigmaAsset('5c0f670827aa0d401dd409a6c603459c23b5c4a3.png'),
        'figma:asset/5ad590314498c6876333b25d45ae64ea2938787f.png': resolveFigmaAsset('5ad590314498c6876333b25d45ae64ea2938787f.png'),
        'figma:asset/58e37d5523feb65e353e0ac15275fd8643fc65e9.png': resolveFigmaAsset('58e37d5523feb65e353e0ac15275fd8643fc65e9.png'),
        'figma:asset/543ae964645db88228743731ee3eebbbc2e3686e.png': resolveFigmaAsset('543ae964645db88228743731ee3eebbbc2e3686e.png'),
        'figma:asset/4edbc4d460d0ae6f679b5227752c118d5306e279.png': resolveFigmaAsset('4edbc4d460d0ae6f679b5227752c118d5306e279.png'),
        'figma:asset/4dff620ccf41d937ddc51c69e7668b15889a633c.png': resolveFigmaAsset('4dff620ccf41d937ddc51c69e7668b15889a633c.png'),
        'figma:asset/482a45127e501f4b3cecd244241cff6024f47011.png': resolveFigmaAsset('482a45127e501f4b3cecd244241cff6024f47011.png'),
        'figma:asset/47655f7ea49b8154455dbaefe83366869b59cabb.png': resolveFigmaAsset('47655f7ea49b8154455dbaefe83366869b59cabb.png'),
        'figma:asset/46902e1b4e7cc612eaf07c17fb1352b7bdb1d876.png': resolveFigmaAsset('46902e1b4e7cc612eaf07c17fb1352b7bdb1d876.png'),
        'figma:asset/4660d44f48d1f87bfd648cf720e5e52343bf1111.png': resolveFigmaAsset('4660d44f48d1f87bfd648cf720e5e52343bf1111.png'),
        'figma:asset/3d217dec77363c6bc2c7322ec7ce8c6e59f53f53.png': resolveFigmaAsset('3d217dec77363c6bc2c7322ec7ce8c6e59f53f53.png'),
        'figma:asset/3adf41eeb556dca874c10a95709eda0ec378bf9e.png': resolveFigmaAsset('3adf41eeb556dca874c10a95709eda0ec378bf9e.png'),
        'figma:asset/3a20bd72e539d6d53bb18a444a908939ce9db465.png': resolveFigmaAsset('3a20bd72e539d6d53bb18a444a908939ce9db465.png'),
        'figma:asset/365200c034a353b5beb7a8f5a03c2a1a537c101b.png': resolveFigmaAsset('365200c034a353b5beb7a8f5a03c2a1a537c101b.png'),
        'figma:asset/1f32a99aadd795f3c7f5c530f916c758d6ccb6f0.png': resolveFigmaAsset('1f32a99aadd795f3c7f5c530f916c758d6ccb6f0.png'),
        'figma:asset/131a8ec979ac2253c0267cb9f4d58cb3f56e8dfc.png': resolveFigmaAsset('131a8ec979ac2253c0267cb9f4d58cb3f56e8dfc.png'),
        'figma:asset/0eb19d8516137ad854c3e1eff7fd832575e13bbe.png': resolveFigmaAsset('0eb19d8516137ad854c3e1eff7fd832575e13bbe.png'),
        'figma:asset/0e2b917f64eba502a24068ea5244bd25b0dfc9d5.png': resolveFigmaAsset('0e2b917f64eba502a24068ea5244bd25b0dfc9d5.png'),
        'figma:asset/0a60effb7ee71f5609f910b26a2203fd47255d98.png': resolveFigmaAsset('0a60effb7ee71f5609f910b26a2203fd47255d98.png'),
        'figma:asset/06f4f0d6aa6b0eb2450e2a43380c2e2d29ad658b.png': resolveFigmaAsset('06f4f0d6aa6b0eb2450e2a43380c2e2d29ad658b.png'),
        'figma:asset/06a90a7204a3a0765a6ffe95ae6db0a382ea2312.png': resolveFigmaAsset('06a90a7204a3a0765a6ffe95ae6db0a382ea2312.png'),
        'figma:asset/05476d116bd826bed8f620f9ca8ef63eeaa74a6f.png': resolveFigmaAsset('05476d116bd826bed8f620f9ca8ef63eeaa74a6f.png'),
        'figma:asset/00f21f624e8160ae5a1793de40e7c0e7ba1ee60d.png': resolveFigmaAsset('00f21f624e8160ae5a1793de40e7c0e7ba1ee60d.png'),
        '@supabase/supabase-js@2.39.3': '@supabase/supabase-js',
        '@jsr/supabase__supabase-js@2.49.8': '@jsr/supabase__supabase-js',
        '@': path.resolve(__dirname, './src'),
      },
    },
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: getManualChunk,
      },
    },
  },
    server: {
      port: 3000,
      open: true,
    },
  });

