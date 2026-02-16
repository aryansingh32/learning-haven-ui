import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";

export const AuthLayout = () => {
    return (
        <div className="min-h-screen bg-depth flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">
                        <span className="text-gradient-golden">DSA</span> OS
                    </h1>
                    <p className="text-muted-foreground mt-2 tracking-wide">Master Algorithms & System Design</p>
                </div>
                <Outlet />
            </motion.div>
        </div>
    );
};
