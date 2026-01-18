/**
 * Role Computation Worker
 * Updates user dynamic roles based on engagement patterns
 * Runs weekly (Sunday 2 AM)
 */

import { roleQueue } from '../jobs';
import { roleService } from '../services/role';
import { logger } from '../utils/logger';

// Process batch role computation (weekly)
roleQueue.process('compute-all', async () => {
    logger.info(`[Role Worker] Starting batch role computation...`);

    try {
        const result = await roleService.updateAllUserRoles(30); // Last 30 days

        logger.info(`[Role Worker] Batch computation complete`, result);

        return result;

    } catch (error) {
        logger.error(`[Role Worker] Batch computation failed:`, error);
        throw error;
    }
});

// Process single user role update
roleQueue.process('compute-user', async (job) => {
    const { userId } = job.data as { userId: string };

    logger.info(`[Role Worker] Computing roles for user: ${userId}`);

    try {
        const result = await roleService.updateUserRoles(userId);

        if (result) {
            logger.info(`[Role Worker] Updated roles for ${userId}`, {
                newRoles: result.newRoles,
            });
        }

        return result;

    } catch (error) {
        logger.error(`[Role Worker] User role update failed:`, error);
        throw error;
    }
});

export { roleQueue };
