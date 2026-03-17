/**
 * WelcomeMessage Component
 * 
 * Welcome message with feature list and instructions.
 * 
 * @module advice-engine/components/WelcomeMessage
 */

import React from 'react';
import { Brain } from 'lucide-react';
import type { WelcomeMessageProps } from '../types';

/**
 * Default features list
 */
const DEFAULT_FEATURES = [
  {
    icon: '📊',
    title: 'Client Intelligence',
    items: [
      'View client profiles, policies, and compliance status',
      'Analyze risk profiles and financial positions',
      'Review communication history and notes',
    ],
  },
  {
    icon: '🔍',
    title: 'Platform Operations',
    items: [
      'Check pending applications and requests',
      'View upcoming events and reviews',
      'Track to-do items and deadlines',
    ],
  },
  {
    icon: '💼',
    title: 'Advisory Support',
    items: [
      'Get regulatory guidance (FAIS, FICA, SARS)',
      'Compare products and strategies',
      'Identify risks and opportunities',
    ],
  },
];

/**
 * Welcome message component
 * 
 * @example
 * <WelcomeMessage />
 * 
 * // With custom content
 * <WelcomeMessage
 *   content="Custom welcome message"
 *   features={['Feature 1', 'Feature 2']}
 * />
 */
export function WelcomeMessage({
  content,
  features,
}: WelcomeMessageProps = {}) {
  const displayFeatures = features || DEFAULT_FEATURES;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Custom Content or Default */}
      {content ? (
        <div className="text-sm text-gray-700 whitespace-pre-wrap">{content}</div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center mx-auto border border-violet-200">
              <Brain className="h-6 w-6 text-violet-700" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">
              Ask Vasco
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Your AI-powered advisory assistant. Ask about client finances, regulations, or products.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-3 gap-4">
            {displayFeatures.map((feature, index) => (
              <div 
                key={index} 
                className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm"
              >
                {typeof feature === 'string' ? (
                  <p className="text-sm text-gray-700">• {feature}</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{feature.icon}</span>
                      <h4 className="text-sm font-semibold text-gray-900">{feature.title}</h4>
                    </div>
                    <ul className="space-y-1">
                      {feature.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-violet-400 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}