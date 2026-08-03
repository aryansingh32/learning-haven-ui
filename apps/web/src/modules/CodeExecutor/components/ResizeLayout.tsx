import React from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

interface ResizeLayoutProps {
    leftPanel: React.ReactNode;
    rightTopPanel: React.ReactNode;
    rightBottomPanel: React.ReactNode;
    className?: string;
    leftDefaultSize?: number;
    leftMinSize?: number;
    rightTopDefaultSize?: number;
    rightTopMinSize?: number;
    rightBottomDefaultSize?: number;
    rightBottomMinSize?: number;
}

export const ResizeLayout: React.FC<ResizeLayoutProps> = ({
    leftPanel,
    rightTopPanel,
    rightBottomPanel,
    className,
    leftDefaultSize = 40,
    leftMinSize = 25,
    rightTopDefaultSize = 65,
    rightTopMinSize = 30,
    rightBottomDefaultSize = 35,
    rightBottomMinSize = 15,
}) => {
    return (
        <div className={cn("h-full w-full bg-background overflow-hidden", className)}>
            <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                <ResizablePanel
                    defaultSize={leftDefaultSize}
                    minSize={leftMinSize}
                    className="bg-card/30 backdrop-blur-sm"
                >
                    <div className="h-full w-full overflow-hidden border-r border-border/50">
                        {leftPanel}
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle className="w-1.5 bg-border/20 hover:bg-primary/30 transition-colors" />

                <ResizablePanel defaultSize={60}>
                    <ResizablePanelGroup direction="vertical">
                        <ResizablePanel
                            defaultSize={rightTopDefaultSize}
                            minSize={rightTopMinSize}
                            className="flex flex-col"
                        >
                            <div className="flex-1 w-full overflow-hidden">
                                {rightTopPanel}
                            </div>
                        </ResizablePanel>

                        <ResizableHandle withHandle className="h-1.5 bg-border/20 hover:bg-primary/30 transition-colors" />

                        <ResizablePanel defaultSize={rightBottomDefaultSize} minSize={rightBottomMinSize}>
                            <div className="h-full w-full overflow-hidden">
                                {rightBottomPanel}
                            </div>
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
};
