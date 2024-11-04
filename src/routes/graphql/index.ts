import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import {
  graphql,
  GraphQLInputType,
  GraphQLNonNull,
  GraphQLFloat,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLEnumType,
  GraphQLInt,
  GraphQLList,
  GraphQLBoolean,
} from 'graphql';
import { UUIDType } from './types/uuid.js';

const MemberTypeId = new GraphQLEnumType({
  name: 'MemberTypeId',
  values: {
    BASIC: { value: 'BASIC' },
    BUSINESS: { value: 'BUSINESS' },
  },
});

const MemberType = new GraphQLObjectType({
  name: 'memberType',
  fields: {
    id: { type: new GraphQLNonNull(MemberTypeId) },
    discount: { type: new GraphQLNonNull(GraphQLFloat) },
    postsLimitPerMonth: { type: new GraphQLNonNull(GraphQLInt) },
  },
});

const MemberTypeListType = new GraphQLList(MemberType);

const Post = new GraphQLObjectType({
  name: 'Post',
  fields: {
    id: { type: new GraphQLNonNull(UUIDType) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    content: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const Posts = new GraphQLList(new GraphQLNonNull(Post));

const Profile = new GraphQLObjectType({
  name: 'Profile',
  fields: {
    id: { type: new GraphQLNonNull(UUIDType) },
    isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
    yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
    memberType: {
      type: new GraphQLNonNull(MemberType),
      resolve: async (parent, _, context) => {
        return context.prisma.memberType.findUnique({
          where: { id: parent.memberTypeId },
        });
      },
    },
  },
});

const ProfileList = new GraphQLList(Profile);

const User = new GraphQLObjectType({
  name: 'user',
  fields: () => ({
    id: { type: new GraphQLNonNull(UUIDType) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
    profile: {
      type: Profile,
      resolve: async (parent, _, context) => {
        return context.prisma.profile.findUnique({
          where: { userId: parent.id },
        });
      },
    },
    posts: {
      type: new GraphQLNonNull(Posts),
      resolve: async (parent, _, context) => {
        if (parent.id) {
          return context.prisma.post.findMany({
            where: { authorId: parent.id },
          });
        }
        return null;
      },
    },
    userSubscribedTo: {
      type: new GraphQLNonNull(new GraphQLList(User)),
      resolve: async (parent, _, context) => {
        return context.prisma.user.findMany({
          where: {
            subscribedToUser: {
              some: {
                subscriberId: parent.id,
              },
            },
          },
        });
      },
    },
    subscribedToUser: {
      type: new GraphQLNonNull(new GraphQLList(User)),
      resolve: async (parent, _, context) => {
        return context.prisma.user.findMany({
          where: {
            userSubscribedTo: {
              some: {
                authorId: parent.id,
              },
            },
          },
        });
      },
    },
  }),
});

const UserList = new GraphQLList(User);

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;

  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      ...createGqlResponseSchema,
      response: {
        200: gqlResponseSchema,
      },
    },
    async handler(req) {
      return graphql({
        schema,
        source: req.body.query,
        contextValue: { prisma },
        variableValues: req.body.variables,
      });
    },
  });

  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'RootQuery',
      fields: {
        memberTypes: {
          type: MemberTypeListType,
          resolve: async () => prisma.memberType.findMany(),
        },
        memberType: {
          type: MemberType,
          args: {
            id: { type: MemberTypeId },
          },
          resolve: async (_, args) =>
            prisma.memberType.findUnique({
              where: { id: args.id },
            }),
        },
        users: {
          type: UserList,
          resolve: async () => prisma.user.findMany(),
        },
        user: {
          type: User,
          args: {
            id: { type: new GraphQLNonNull(UUIDType) },
          },
          resolve: async (_, args) =>
            prisma.user.findUnique({
              where: {
                id: args.id,
              },
            }),
        },
        posts: {
          type: Posts,
          resolve: async () => prisma.post.findMany(),
        },
        post: {
          type: Post,
          args: {
            id: { type: new GraphQLNonNull(UUIDType) },
          },
          resolve: async (_, args) => {
            return prisma.post.findUnique({
              where: {
                id: args.id,
              },
            });
          },
        },
        profiles: {
          type: ProfileList,
          resolve: async () => prisma.profile.findMany(),
        },
        profile: {
          type: Profile,
          args: {
            id: { type: new GraphQLNonNull(UUIDType) },
          },
          resolve: async (_, args) => {
            return prisma.profile.findUnique({
              where: {
                id: args.id,
              },
            });
          },
        },
      },
    }),
  });
};

export default plugin;