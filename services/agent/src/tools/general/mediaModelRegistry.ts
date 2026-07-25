import assert from 'node:assert/strict';

export const IMAGE_MODEL_KEYS = [
  'studio_background',
  'nano_banana_2',
  'nano_banana_2_lite',
  'nano_banana_pro',
  'gpt_image_2',
] as const;

export const VIDEO_MODEL_KEYS = ['seedance_2', 'seedance_2_fast'] as const;

export type ImageModelKey = (typeof IMAGE_MODEL_KEYS)[number];
export type VideoModelKey = (typeof VIDEO_MODEL_KEYS)[number];
export type MediaModelKey = ImageModelKey | VideoModelKey;

/** Unified tool-level ratios; registry maps to Fal `image_size` or `aspect_ratio`. */
export const TOOL_ASPECT_RATIOS = [
  '21:9',
  '16:9',
  '4:3',
  '3:2',
  '5:4',
  '1:1',
  '4:5',
  '3:4',
  '2:3',
  '9:16',
  '4:1',
  '1:4',
  '8:1',
  '1:8',
  'auto',
] as const;

export type ToolAspectRatio = (typeof TOOL_ASPECT_RATIOS)[number];

export const VIDEO_DURATIONS = [
  'auto',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
] as const;

export type VideoDuration = (typeof VIDEO_DURATIONS)[number];

type SizeMode = 'image_size' | 'aspect_ratio';

type ImageConstraints = {
  sizes: readonly string[];
  resolutions?: readonly string[];
  qualities?: readonly string[];
};

type VideoConstraints = {
  aspectRatios: readonly string[];
  resolutions: readonly string[];
  durations: readonly string[];
};

type ImageModelEntry = {
  kind: 'image';
  falModel: string;
  sizeMode: SizeMode;
  defaultParams: Record<string, unknown>;
  constraints: ImageConstraints;
};

type VideoModelEntry = {
  kind: 'video';
  falModel: string;
  falModelImageToVideo: string;
  sizeMode: 'aspect_ratio';
  defaultParams: Record<string, unknown>;
  constraints: VideoConstraints;
};

const ASPECT_TO_IMAGE_SIZE: Record<string, string> = {
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3': 'landscape_4_3',
  '3:4': 'portrait_4_3',
  '1:1': 'square_hd',
  auto: 'auto',
};

const NANO_ASPECT_RATIOS = [
  'auto',
  '21:9',
  '16:9',
  '3:2',
  '4:3',
  '5:4',
  '1:1',
  '4:5',
  '3:4',
  '2:3',
  '9:16',
  '4:1',
  '1:4',
  '8:1',
  '1:8',
] as const;

const NANO_PRO_ASPECT_RATIOS = [
  'auto',
  '21:9',
  '16:9',
  '3:2',
  '4:3',
  '5:4',
  '1:1',
  '4:5',
  '3:4',
  '2:3',
  '9:16',
] as const;

const KLEIN_IMAGE_SIZES = [
  'square_hd',
  'square',
  'portrait_4_3',
  'portrait_16_9',
  'landscape_4_3',
  'landscape_16_9',
] as const;

const GPT_IMAGE_SIZES = [...KLEIN_IMAGE_SIZES, 'auto'] as const;

const SEEDANCE_ASPECT_RATIOS = [
  'auto',
  '21:9',
  '16:9',
  '4:3',
  '1:1',
  '3:4',
  '9:16',
] as const;

const SEEDANCE_RESOLUTIONS = ['480p', '720p'] as const;

const IMAGE_MODELS: Record<ImageModelKey, ImageModelEntry> = {
  studio_background: {
    kind: 'image',
    falModel: 'fal-ai/flux-2/klein/9b',
    sizeMode: 'image_size',
    defaultParams: {
      image_size: 'landscape_16_9',
      num_inference_steps: 4,
      num_images: 1,
      output_format: 'png',
      enable_safety_checker: true,
    },
    constraints: { sizes: KLEIN_IMAGE_SIZES },
  },
  nano_banana_2: {
    kind: 'image',
    falModel: 'fal-ai/nano-banana-2',
    sizeMode: 'aspect_ratio',
    defaultParams: {
      aspect_ratio: '16:9',
      resolution: '1K',
      num_images: 1,
    },
    constraints: {
      sizes: NANO_ASPECT_RATIOS,
      resolutions: ['0.5K', '1K', '2K', '4K'],
    },
  },
  nano_banana_2_lite: {
    kind: 'image',
    falModel: 'google/nano-banana-2-lite',
    sizeMode: 'aspect_ratio',
    defaultParams: {
      aspect_ratio: '16:9',
      num_images: 1,
    },
    constraints: { sizes: NANO_ASPECT_RATIOS },
  },
  nano_banana_pro: {
    kind: 'image',
    falModel: 'fal-ai/nano-banana-pro',
    sizeMode: 'aspect_ratio',
    defaultParams: {
      aspect_ratio: '16:9',
      resolution: '1K',
      num_images: 1,
    },
    constraints: {
      sizes: NANO_PRO_ASPECT_RATIOS,
      resolutions: ['1K', '2K', '4K'],
    },
  },
  gpt_image_2: {
    kind: 'image',
    falModel: 'openai/gpt-image-2',
    sizeMode: 'image_size',
    defaultParams: {
      image_size: 'landscape_16_9',
      quality: 'high',
      num_images: 1,
    },
    constraints: {
      sizes: GPT_IMAGE_SIZES,
      qualities: ['auto', 'low', 'medium', 'high'],
    },
  },
};

const VIDEO_MODELS: Record<VideoModelKey, VideoModelEntry> = {
  seedance_2: {
    kind: 'video',
    falModel: 'bytedance/seedance-2.0/text-to-video',
    falModelImageToVideo: 'bytedance/seedance-2.0/image-to-video',
    sizeMode: 'aspect_ratio',
    defaultParams: {
      aspect_ratio: '16:9',
      resolution: '720p',
      duration: '5',
      generate_audio: false,
    },
    constraints: {
      aspectRatios: SEEDANCE_ASPECT_RATIOS,
      resolutions: SEEDANCE_RESOLUTIONS,
      durations: VIDEO_DURATIONS,
    },
  },
  seedance_2_fast: {
    kind: 'video',
    falModel: 'bytedance/seedance-2.0/fast/text-to-video',
    falModelImageToVideo: 'bytedance/seedance-2.0/fast/image-to-video',
    sizeMode: 'aspect_ratio',
    defaultParams: {
      aspect_ratio: '16:9',
      resolution: '720p',
      duration: '5',
      generate_audio: false,
    },
    constraints: {
      aspectRatios: SEEDANCE_ASPECT_RATIOS,
      resolutions: SEEDANCE_RESOLUTIONS,
      durations: VIDEO_DURATIONS,
    },
  },
};

export function getImageModel(key: ImageModelKey): ImageModelEntry {
  const entry = IMAGE_MODELS[key];
  if (!entry) throw new Error(`Unknown image model: ${key}`);
  return entry;
}

export function getVideoModel(key: VideoModelKey): VideoModelEntry {
  const entry = VIDEO_MODELS[key];
  if (!entry) throw new Error(`Unknown video model: ${key}`);
  return entry;
}

export function resolveVideoFalModel(
  entry: VideoModelEntry,
  hasReferenceImage: boolean
): string {
  return hasReferenceImage ? entry.falModelImageToVideo : entry.falModel;
}

function mapAspectToImageSize(aspect: string | undefined, fallback: unknown): unknown {
  if (!aspect) return fallback;
  return ASPECT_TO_IMAGE_SIZE[aspect] ?? fallback;
}

export function buildImageInput(
  key: ImageModelKey,
  opts: {
    prompt: string;
    aspect_ratio?: string;
    resolution?: string;
  }
): { falModel: string; input: Record<string, unknown> } {
  const entry = getImageModel(key);
  const input: Record<string, unknown> = {
    ...entry.defaultParams,
    prompt: opts.prompt,
  };

  if (entry.sizeMode === 'image_size') {
    const mapped = mapAspectToImageSize(
      opts.aspect_ratio,
      entry.defaultParams.image_size
    );
    if (
      opts.aspect_ratio &&
      mapped === entry.defaultParams.image_size &&
      ASPECT_TO_IMAGE_SIZE[opts.aspect_ratio] == null
    ) {
      throw new Error(
        `aspect_ratio '${opts.aspect_ratio}' is not valid for ${key}`
      );
    }
    if (!entry.constraints.sizes.includes(mapped as string)) {
      throw new Error(`image_size '${mapped}' is not valid for ${key}`);
    }
    input.image_size = mapped;
  } else if (opts.aspect_ratio) {
    if (!entry.constraints.sizes.includes(opts.aspect_ratio)) {
      throw new Error(
        `aspect_ratio '${opts.aspect_ratio}' is not valid for ${key}`
      );
    }
    input.aspect_ratio = opts.aspect_ratio;
  }

  if (opts.resolution) {
    if (!entry.constraints.resolutions) {
      // lite / models without resolution — omit silently
      delete input.resolution;
    } else if (!entry.constraints.resolutions.includes(opts.resolution)) {
      throw new Error(
        `resolution '${opts.resolution}' is not valid for ${key}`
      );
    } else {
      input.resolution = opts.resolution;
    }
  } else if (!entry.constraints.resolutions) {
    delete input.resolution;
  }

  return { falModel: entry.falModel, input };
}

export function buildVideoInput(
  key: VideoModelKey,
  opts: {
    prompt: string;
    aspect_ratio?: string;
    duration?: string;
    resolution?: string;
    reference_image_url?: string;
  }
): { falModel: string; input: Record<string, unknown> } {
  const entry = getVideoModel(key);
  const hasRef = Boolean(opts.reference_image_url?.trim());
  const falModel = resolveVideoFalModel(entry, hasRef);

  const input: Record<string, unknown> = {
    ...entry.defaultParams,
    prompt: opts.prompt,
  };

  if (opts.aspect_ratio) {
    if (!entry.constraints.aspectRatios.includes(opts.aspect_ratio)) {
      throw new Error(
        `aspect_ratio '${opts.aspect_ratio}' is not valid for ${key}`
      );
    }
    input.aspect_ratio = opts.aspect_ratio;
  }

  if (opts.duration !== undefined) {
    const duration = String(opts.duration);
    if (!entry.constraints.durations.includes(duration)) {
      throw new Error(`duration '${duration}' is not valid for ${key}`);
    }
    input.duration = duration;
  } else {
    input.duration = String(entry.defaultParams.duration);
  }

  if (opts.resolution) {
    if (!entry.constraints.resolutions.includes(opts.resolution)) {
      throw new Error(
        `resolution '${opts.resolution}' is not valid for ${key}`
      );
    }
    input.resolution = opts.resolution;
  }

  if (hasRef) {
    input.image_url = opts.reference_image_url!.trim();
  }

  return { falModel, input };
}

export function selfcheckMediaModelRegistry(): void {
  assert.deepEqual(
    Object.keys(IMAGE_MODELS).sort(),
    [...IMAGE_MODEL_KEYS].sort()
  );
  assert.deepEqual(
    Object.keys(VIDEO_MODELS).sort(),
    [...VIDEO_MODEL_KEYS].sort()
  );

  for (const key of VIDEO_MODEL_KEYS) {
    const entry = getVideoModel(key);
    for (const res of entry.constraints.resolutions) {
      assert.ok(
        res === '480p' || res === '720p',
        `${key} resolution ${res} outside {480p,720p}`
      );
    }
    assert.equal(
      resolveVideoFalModel(entry, false),
      entry.falModel,
      `${key} T2V slug`
    );
    assert.equal(
      resolveVideoFalModel(entry, true),
      entry.falModelImageToVideo,
      `${key} I2V slug`
    );
  }

  const i2v = buildVideoInput('seedance_2_fast', {
    prompt: 'test',
    reference_image_url: 'https://example.com/ref.png',
  });
  assert.equal(
    i2v.falModel,
    'bytedance/seedance-2.0/fast/image-to-video'
  );
  assert.equal(i2v.input.image_url, 'https://example.com/ref.png');
  assert.equal(typeof i2v.input.duration, 'string');

  const lite = buildImageInput('nano_banana_2_lite', {
    prompt: 'test',
    aspect_ratio: '16:9',
    resolution: '2K',
  });
  assert.equal(lite.falModel, 'google/nano-banana-2-lite');
  assert.equal(lite.input.aspect_ratio, '16:9');
  assert.equal('resolution' in lite.input, false);

  const studio = buildImageInput('studio_background', {
    prompt: 'classroom',
    aspect_ratio: '16:9',
  });
  assert.equal(studio.input.image_size, 'landscape_16_9');
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  /mediaModelRegistry\.(ts|js)$/.test(process.argv[1]);

if (isMain) {
  selfcheckMediaModelRegistry();
  console.log('mediaModelRegistry selfcheck ok');
}
