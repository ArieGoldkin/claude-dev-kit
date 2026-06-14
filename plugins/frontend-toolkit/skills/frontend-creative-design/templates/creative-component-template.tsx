import React from 'react';
import { motion } from 'framer-motion';

// Creative component template with flexible styling system
interface CreativeComponentProps {
  aesthetic?: 'minimal' | 'maximal' | 'organic' | 'geometric' | 'editorial';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'accent';
  interactive?: boolean;
  animate?: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const CreativeComponent: React.FC<CreativeComponentProps> = ({
  aesthetic = 'minimal',
  size = 'md',
  variant = 'primary',
  interactive = false,
  animate = true,
  children,
  className = '',
  onClick,
  ...props
}) => {
  // Animation variants based on aesthetic
  const animationVariants = {
    minimal: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] }
    },
    maximal: {
      initial: { opacity: 0, scale: 0.8, rotate: -2 },
      animate: { opacity: 1, scale: 1, rotate: 0 },
      transition: { duration: 0.8, ease: [0.68, -0.55, 0.265, 1.55] }
    },
    organic: {
      initial: { opacity: 0, scale: 0.9, borderRadius: '50%' },
      animate: { opacity: 1, scale: 1, borderRadius: '1rem' },
      transition: { duration: 0.7, ease: [0.23, 1, 0.32, 1] }
    },
    geometric: {
      initial: { opacity: 0, clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)' },
      animate: { opacity: 1, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' },
      transition: { duration: 0.8, ease: [0.23, 1, 0.32, 1] }
    },
    editorial: {
      initial: { opacity: 0, x: -30 },
      animate: { opacity: 1, x: 0 },
      transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] }
    }
  };

  // Hover animations for interactive elements
  const hoverVariants = {
    minimal: { scale: 1.02, transition: { duration: 0.2 } },
    maximal: { scale: 1.1, rotate: 1, transition: { duration: 0.3 } },
    organic: { scale: 1.05, borderRadius: '2rem', transition: { duration: 0.3 } },
    geometric: { scale: 1.03, transition: { duration: 0.2 } },
    editorial: { x: 5, transition: { duration: 0.2 } }
  };

  const baseClasses = [
    'creative-component',
    `creative-component--${aesthetic}`,
    `creative-component--${size}`,
    `creative-component--${variant}`,
    interactive && 'creative-component--interactive',
    className
  ].filter(Boolean).join(' ');

  const Component = animate ? motion.div : 'div';

  const animationProps = animate ? {
    ...animationVariants[aesthetic],
    whileHover: interactive ? hoverVariants[aesthetic] : undefined,
  } : {};

  return (
    <Component
      className={baseClasses}
      onClick={onClick}
      data-aesthetic={aesthetic}
      data-size={size}
      data-variant={variant}
      {...animationProps}
      {...props}
    >
      {children}
    </Component>
  );
};

export default CreativeComponent;

/* CSS Variables for easy customization */
/*
:root {
  // Aesthetic-specific properties
  --creative-minimal-bg: hsl(0, 0%, 98%);
  --creative-minimal-border: hsl(0, 0%, 85%);
  --creative-minimal-text: hsl(0, 0%, 20%);

  --creative-maximal-bg: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --creative-maximal-text: white;
  --creative-maximal-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);

  --creative-organic-bg: #f0f4f0;
  --creative-organic-border: #d4e6d4;
  --creative-organic-radius: 2rem;

  --creative-geometric-bg: #f8fafc;
  --creative-geometric-border: #2d3748;
  --creative-geometric-clip: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);

  --creative-editorial-bg: white;
  --creative-editorial-border-left: 4px solid #2d3748;
  --creative-editorial-font: 'Times New Roman', serif;
}

.creative-component {
  position: relative;
  padding: var(--space-md);
  border-radius: var(--space-sm);
  transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
}

// Aesthetic variants
.creative-component--minimal {
  background: var(--creative-minimal-bg);
  border: 1px solid var(--creative-minimal-border);
  color: var(--creative-minimal-text);
}

.creative-component--maximal {
  background: var(--creative-maximal-bg);
  color: var(--creative-maximal-text);
  box-shadow: var(--creative-maximal-shadow);
  border: none;
}

.creative-component--organic {
  background: var(--creative-organic-bg);
  border: 2px solid var(--creative-organic-border);
  border-radius: var(--creative-organic-radius);
}

.creative-component--geometric {
  background: var(--creative-geometric-bg);
  border: 2px solid var(--creative-geometric-border);
  clip-path: var(--creative-geometric-clip);
}

.creative-component--editorial {
  background: var(--creative-editorial-bg);
  border-left: var(--creative-editorial-border-left);
  font-family: var(--creative-editorial-font);
  padding-left: var(--space-lg);
}

// Size variants
.creative-component--sm {
  padding: var(--space-sm);
  font-size: 0.875rem;
}

.creative-component--lg {
  padding: var(--space-lg);
  font-size: 1.125rem;
}

// Interactive states
.creative-component--interactive {
  cursor: pointer;
}

.creative-component--interactive:hover {
  transform: translateY(-2px);
}

// Variant-specific hover effects
.creative-component--minimal.creative-component--interactive:hover {
  background: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.creative-component--maximal.creative-component--interactive:hover {
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);
}

.creative-component--organic.creative-component--interactive:hover {
  background: #e8f4e8;
  border-radius: 3rem;
}

.creative-component--geometric.creative-component--interactive:hover {
  clip-path: polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px);
}

.creative-component--editorial.creative-component--interactive:hover {
  border-left-width: 6px;
  padding-left: calc(var(--space-lg) - 2px);
}
*/

/* Usage Examples:

// Minimal card
<CreativeComponent aesthetic="minimal" size="md" interactive>
  <h3>Clean Design</h3>
  <p>Focused on content with subtle styling</p>
</CreativeComponent>

// Maximal hero section
<CreativeComponent aesthetic="maximal" size="lg" animate>
  <h1>Bold Statement</h1>
  <p>Rich visual effects and dramatic styling</p>
</CreativeComponent>

// Organic health component
<CreativeComponent aesthetic="organic" interactive onClick={handleClick}>
  <div>Natural, flowing design for health apps</div>
</CreativeComponent>

// Geometric tech component
<CreativeComponent aesthetic="geometric" variant="accent">
  <code>Structured, mathematical precision</code>
</CreativeComponent>

// Editorial content block
<CreativeComponent aesthetic="editorial" size="lg">
  <blockquote>
    Typography-focused design with editorial hierarchy
  </blockquote>
</CreativeComponent>

*/