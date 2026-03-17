/**
 * Social Media AI Hook
 *
 * React Query hook for AI-powered social media content generation
 * (text, image, and bundle).
 *
 * @module social-media/hooks/useSocialMediaAI
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { socialMediaAIApi } from '../api';
import { socialMediaKeys } from './queryKeys';
import type {
  GeneratePostTextInput,
  GeneratePostTextResult,
  GenerateImageInput,
  GenerateImageResult,
  GenerateBundleInput,
  GenerateBundleResult,
  AIImageRecord,
  AIGenerationRecord,
} from '../types';

/**
 * Hook for AI social media content generation (text + images + bundles).
 */
export function useSocialMediaAI() {
  const queryClient = useQueryClient();

  // ---------------------------------------------------------------------------
  // Text Generation
  // ---------------------------------------------------------------------------

  const generateTextMutation = useMutation({
    mutationFn: (input: GeneratePostTextInput) =>
      socialMediaAIApi.generatePostText(input),
    onSuccess: (response) => {
      if (response.success) {
        toast.success('AI content generated successfully');
        queryClient.invalidateQueries({
          queryKey: socialMediaKeys.ai.all,
        });
      } else {
        toast.error(response.error || 'Failed to generate content');
      }
    },
    onError: (error: Error) => {
      toast.error(`AI generation failed: ${error.message}`);
    },
  });

  // ---------------------------------------------------------------------------
  // Image Generation
  // ---------------------------------------------------------------------------

  const generateImageMutation = useMutation({
    mutationFn: (input: GenerateImageInput) =>
      socialMediaAIApi.generateImage(input),
    onSuccess: (response) => {
      if (response.success) {
        toast.success('AI image generated successfully');
        queryClient.invalidateQueries({
          queryKey: socialMediaKeys.ai.all,
        });
      } else {
        toast.error(response.error || 'Failed to generate image');
      }
    },
    onError: (error: Error) => {
      toast.error(`Image generation failed: ${error.message}`);
    },
  });

  // ---------------------------------------------------------------------------
  // Bundle Generation (text + image in parallel)
  // ---------------------------------------------------------------------------

  const generateBundleMutation = useMutation({
    mutationFn: (input: GenerateBundleInput) =>
      socialMediaAIApi.generateBundle(input),
    onSuccess: (response) => {
      if (response.success) {
        toast.success('Content bundle generated successfully (text + image)');
        queryClient.invalidateQueries({
          queryKey: socialMediaKeys.ai.all,
        });
      } else {
        toast.error(response.error || 'Failed to generate bundle');
      }
    },
    onError: (error: Error) => {
      toast.error(`Bundle generation failed: ${error.message}`);
    },
  });

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  // AI service status
  const statusQuery = useQuery({
    queryKey: socialMediaKeys.ai.status(),
    queryFn: () => socialMediaAIApi.getStatus(),
    staleTime: 5 * 60 * 1000,
  });

  // Text generation history
  const historyQuery = useQuery({
    queryKey: socialMediaKeys.ai.history(),
    queryFn: () => socialMediaAIApi.getHistory(),
    staleTime: 30 * 1000,
  });

  // Image generation history
  const imageHistoryQuery = useQuery({
    queryKey: socialMediaKeys.ai.imageHistory(),
    queryFn: () => socialMediaAIApi.getImageHistory(),
    staleTime: 30 * 1000,
  });

  return {
    // Text generation
    generatePostText: generateTextMutation.mutateAsync,
    isGenerating: generateTextMutation.isPending,
    generationResult: generateTextMutation.data?.success
      ? (generateTextMutation.data.data as GeneratePostTextResult)
      : null,
    generationError: generateTextMutation.data?.error || null,
    resetGeneration: generateTextMutation.reset,

    // Image generation
    generateImage: generateImageMutation.mutateAsync,
    isGeneratingImage: generateImageMutation.isPending,
    imageResult: generateImageMutation.data?.success
      ? (generateImageMutation.data.data as GenerateImageResult)
      : null,
    imageError: generateImageMutation.data?.error || null,
    resetImageGeneration: generateImageMutation.reset,

    // Bundle generation
    generateBundle: generateBundleMutation.mutateAsync,
    isGeneratingBundle: generateBundleMutation.isPending,
    bundleResult: generateBundleMutation.data?.success
      ? (generateBundleMutation.data.data as GenerateBundleResult)
      : null,
    bundleError: generateBundleMutation.data?.error || null,
    resetBundle: generateBundleMutation.reset,

    // Status
    isConfigured: statusQuery.data?.data?.configured ?? false,
    statusLoading: statusQuery.isLoading,

    // Text history
    history: (historyQuery.data?.data || []) as AIGenerationRecord[],
    historyLoading: historyQuery.isLoading,

    // Image history
    imageHistory: (imageHistoryQuery.data?.data || []) as AIImageRecord[],
    imageHistoryLoading: imageHistoryQuery.isLoading,
  };
}
