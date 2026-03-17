import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "./utils";
import { buttonVariants } from "./button";

// WORKAROUND: Radix AlertDialog.Root is a context provider that returns
// React.Fragment internally.  The Figma inspector injects data-fg-*
// attributes which Fragments cannot accept.  Wrapping in
// <div className="contents"> provides a real DOM target without affecting layout.
function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return (
    <div className="contents">
      <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
    </div>
  );
}
AlertDialog.displayName = "AlertDialog";

const AlertDialogTrigger = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Trigger>
>(({ ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Trigger ref={ref} data-slot="alert-dialog-trigger" {...props} />
  );
});
AlertDialogTrigger.displayName = "AlertDialogTrigger";

// WORKAROUND: Radix Portal renders as React.Fragment internally.
// Wrapping in <div className="contents"> gives the Figma inspector
// a real DOM element to attach data-fg-* attributes to.
function AlertDialogPortal({
  children,
  container,
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <div className="contents">
      <AlertDialogPrimitive.Portal container={container}>{children}</AlertDialogPrimitive.Portal>
    </div>
  );
}
AlertDialogPortal.displayName = "AlertDialogPortal";

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Overlay
      ref={ref}
      data-slot="alert-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
});
AlertDialogOverlay.displayName = "AlertDialogOverlay";

// VisuallyHidden component for accessibility
const VisuallyHidden = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0",
      className
    )}
    {...props}
  />
));
VisuallyHidden.displayName = "VisuallyHidden";

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & {
    "aria-labelledby"?: string;
    "aria-describedby"?: string;
  }
>(({ className, children, ...props }, ref) => {
  // Check if children contains AlertDialogTitle and AlertDialogDescription for accessibility
  const hasTitle = React.Children.toArray(children).some((child) => 
    React.isValidElement(child) && 
    (child.type === AlertDialogTitle || 
     (typeof child.type === 'object' && child.type?.displayName === 'AlertDialogTitle') ||
     child.props?.['data-slot'] === 'alert-dialog-title')
  );
  
  const hasDescription = React.Children.toArray(children).some((child) => 
    React.isValidElement(child) && 
    (child.type === AlertDialogDescription || 
     (typeof child.type === 'object' && child.type?.displayName === 'AlertDialogDescription') ||
     child.props?.['data-slot'] === 'alert-dialog-description')
  );

  // If no title or description found in children, and no aria attributes provided, add default hidden ones
  const needsTitle = !hasTitle && !props['aria-labelledby'];
  const needsDescription = !hasDescription && !props['aria-describedby'];

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={ref}
        data-slot="alert-dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className,
        )}
        {...props}
      >
        {needsTitle && (
          <VisuallyHidden>
            <AlertDialogTitle>Alert Dialog</AlertDialogTitle>
          </VisuallyHidden>
        )}
        {needsDescription && (
          <VisuallyHidden>
            <AlertDialogDescription>Alert dialog content</AlertDialogDescription>
          </VisuallyHidden>
        )}
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
});
AlertDialogContent.displayName = "AlertDialogContent";

const AlertDialogHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
});
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
});
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Title
      ref={ref}
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
});
AlertDialogTitle.displayName = "AlertDialogTitle";

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Description
      ref={ref}
      data-slot="alert-dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
});
AlertDialogDescription.displayName = "AlertDialogDescription";

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Action
      ref={ref}
      className={cn(buttonVariants(), className)}
      {...props}
    />
  );
});
AlertDialogAction.displayName = "AlertDialogAction";

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Cancel
      ref={ref}
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  );
});
AlertDialogCancel.displayName = "AlertDialogCancel";

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  VisuallyHidden,
};