import React from 'react';
import Link from 'next/link';
import { motion } from "framer-motion";

const Logo = () => {
  return (
    <div className="flex items-center justify-center mt-2 bg-slate-600 text-white hover:scale-105 transform transition duration-500 ease-in-out">
      <Link href="/" passHref>
        <motion.a
          className="w-16 h-16 flex items-center justify-center rounded-full text-2xl"
          whileHover={{
            scale: 1.1, // Beispiel für eine Skalierungsanimation
            backgroundColor: ["rgba(245, 40, 145, 0.8)", "rgba(137, 63, 101, 0.8)", "rgba(23, 18, 20, 0.8)", "rgba(125, 13, 164, 0.8)", "rgba(54, 7, 71, 1)", "rgba(54, 7, 164, 1)"],
            transition: { duration: 1, repeat: Infinity }
          }}
        >
          EG
        </motion.a>
      </Link>
    </div>
  );
}

export default Logo;
